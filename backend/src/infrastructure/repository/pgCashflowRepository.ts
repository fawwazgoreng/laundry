import type { cashflowRepository, cashflowInput } from "../../domain/repositories/cashflowRepository";
import type { cashflowSummaryType, cashflowType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";

function toCashflowType(row: {
    id: number
    order_id: string | null
    type: string
    category: string
    amount: unknown
    description: string
    created_at: Date
}): cashflowType {
    return {
        id: row.id,
        order_id: row.order_id,
        type: row.type as cashflowType["type"],
        category: row.category,
        amount: Number(row.amount),
        description: row.description,
        created_at: row.created_at.toISOString(),
    };
}

export class pgCashflowRepository implements cashflowRepository {
    async create(input: cashflowInput): Promise<cashflowType> {
        const row = await prisma.cash_flow.create({
            data: {
                order_id: input.order_id ?? null,
                type: input.type,
                category: input.category,
                amount: input.amount,
                description: input.description,
            },
        });
        return toCashflowType(row);
    }

    async summary(): Promise<cashflowSummaryType> {
        const [incomeAgg, expenseAgg, rows] = await Promise.all([
            prisma.cash_flow.aggregate({
                where: { type: "income" },
                _sum: { amount: true },
            }),
            prisma.cash_flow.aggregate({
                where: { type: "expense" },
                _sum: { amount: true },
            }),
            prisma.cash_flow.findMany({ orderBy: { created_at: "desc" }, take: 50 }),
        ]);
        const totalIncome = Number(incomeAgg._sum.amount ?? 0);
        const totalExpense = Number(expenseAgg._sum.amount ?? 0);
        return {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalIncome - totalExpense,
            items: rows.map(toCashflowType),
        };
    }
}