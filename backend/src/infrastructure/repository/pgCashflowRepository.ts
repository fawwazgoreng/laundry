import type { cashflowRepository, cashflowInput } from "../../domain/repositories/cashflowRepository";
import type { cashflowSectionType, cashflowSummaryType, cashflowType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";
import { addMoney, money, subtractMoney, type Money } from "../../lib/money";

function toCashflowSection(items: cashflowType[]): cashflowSectionType {
    const totals = new Map<string, { total: Money; count: number }>();
    let total: Money = money(0);

    for (const item of items) {
        total = addMoney(total, item.amount);
        const current = totals.get(item.category) ?? { total: money(0), count: 0 };
        current.total = addMoney(current.total, item.amount);
        current.count += 1;
        totals.set(item.category, current);
    }

    const categories = Array.from(totals.entries())
        .map(([category, value]) => ({ category, total: value.total, count: value.count }))
        .sort((a, b) => Number(subtractMoney(b.total, a.total)));

    return { total, categories, items };
}

function toCashflowType(row: {
    id: number
    order_id: string | null
    type: string
    category: string
    amount: string
    description: string
    created_at: Date
}): cashflowType {
    return {
        id: row.id,
        order_id: row.order_id,
        type: row.type as cashflowType["type"],
        category: row.category,
        amount: money(row.amount),
        description: row.description,
        created_at: row.created_at.toISOString(),
    };
}

export class pgCashflowRepository implements cashflowRepository {
    async create(input: cashflowInput): Promise<cashflowType> {
        const row = await prisma.orm.Cash_flow.create({
            order_id: input.order_id ?? null,
            type: varchar(input.type),
            category: varchar(input.category),
            amount: numeric(input.amount),
            description: input.description,
        });
        return toCashflowType(row);
    }

    async summary(): Promise<cashflowSummaryType> {
        const [incomeRows, expenseRows] = await Promise.all([
            prisma.orm.Cash_flow
                .where({ type: varchar<20>("income") })
                .orderBy((r) => r.created_at.desc())
                .all(),
            prisma.orm.Cash_flow
                .where({ type: varchar<20>("expense") })
                .orderBy((r) => r.created_at.desc())
                .all(),
        ]);

        const income = toCashflowSection(incomeRows.map(toCashflowType));
        const expense = toCashflowSection(expenseRows.map(toCashflowType));
        const netProfit = subtractMoney(income.total, expense.total);

        const items = [...income.items, ...expense.items].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        return {
            total_income: income.total,
            total_expense: expense.total,
            net_profit: netProfit,
            balance: netProfit,
            income,
            expense,
            items,
        };
    }
}
