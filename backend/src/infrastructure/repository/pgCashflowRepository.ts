import type { cashflowRepository, cashflowInput } from "../../domain/repositories/cashflowRepository";
import type { cashflowSummaryType, cashflowType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";

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
        const [incomeAgg, expenseAgg, rows] = await Promise.all([
            prisma.orm.public.Cash_flow
                .where({ type: varchar<20>("income") })
                .aggregate((agg) => ({ sum: agg.sum("amount") })),
            prisma.orm.public.Cash_flow
                .where({ type: varchar<20>("expense") })
                .aggregate((agg) => ({ sum: agg.sum("amount") })),
            prisma.orm.public.Cash_flow.orderBy((r) => r.created_at.desc()).limit(50).all(),
        ]);
        const totalIncome = Number(incomeAgg.sum ?? 0);
        const totalExpense = Number(expenseAgg.sum ?? 0);
        return {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalIncome - totalExpense,
            items: rows.map(toCashflowType),
        };
    }
}
