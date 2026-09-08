import type { cashflowSummaryType, cashflowType } from "../types/adminType";

export type cashflowInput = {
    order_id?: string | null
    type: "income" | "expense"
    category: string
    amount: number
    description: string
}

export interface cashflowRepository {
    create(input: cashflowInput): Promise<cashflowType>
    summary(): Promise<cashflowSummaryType>
}