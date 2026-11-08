import type { cashflowSummaryType, cashflowType } from "../types/adminType";
import type { Money } from "../../lib/money";

export type cashflowInput = {
    order_id?: string | null
    type: "income" | "expense"
    category: string
    amount: Money
    description: string
}

export interface cashflowRepository {
    create(input: cashflowInput): Promise<cashflowType>
    summary(): Promise<cashflowSummaryType>
}