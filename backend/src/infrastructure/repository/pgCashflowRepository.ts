import type { cashflowRepository, cashflowInput } from "../../domain/repositories/cashflowRepository";
import type { cashflowSectionType, cashflowSummaryType, cashflowType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";

function toCashflowSection(items: cashflowType[]): cashflowSectionType {
    const totals = new Map<string, { total: number; count: number }>();
    let total = 0;

    for (const item of items) {
        total += item.amount;
        const current = totals.get(item.category) ?? { total: 0, count: 0 };
        current.total += item.amount;
        current.count += 1;
        totals.set(item.category, current);
    }

    const categories = Array.from(totals.entries())
        .map(([category, value]) => ({ category, total: value.total, count: value.count }))
        .sort((a, b) => b.total - a.total);

    return { total, categories, items };
}

function toCashflowType(row: {
    id: number
    order_id: string | null
    type: string
    category: string
    amount: unknown
    description: string
    created_at: Temporal.Instant
}): cashflowType {
    return {
        id: row.id,
        order_id: row.order_id,
        type: row.type as cashflowType["type"],
        category: row.category,
        amount: Number(row.amount),
        description: row.description,
        created_at: new Date(row.created_at.epochMilliseconds).toISOString(),
    };
}

export class pgCashflowRepository implements cashflowRepository {
    async create(input: cashflowInput): Promise<cashflowType> {
        const row = await prisma.orm.public.Cash_flow.create({
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
            prisma.orm.public.Cash_flow
                .where({ type: varchar<20>("income") })
                .orderBy((r) => r.created_at.desc())
                .all(),
            prisma.orm.public.Cash_flow
                .where({ type: varchar<20>("expense") })
                .orderBy((r) => r.created_at.desc())
                .all(),
        ]);

        const income = toCashflowSection(incomeRows.map(toCashflowType));
        const expense = toCashflowSection(expenseRows.map(toCashflowType));
        const netProfit = income.total - expense.total;

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
