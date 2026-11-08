import type { Money } from "../../lib/money";
export type paymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export interface paymentType {
    id: string
    order_id: string
    transaction_id: string
    payment_type: string
    gross_amount: Money
    status: paymentStatus
    va_number?: string | null
    paid_at: string | null
    raw_response?: Record<string, unknown> | null
    created_at?: string
}

export type paymentCreateInput = {
    order_id: string
    payment_type: string
    gross_amount: Money
    transaction_id?: string | undefined
    va_number?: string | undefined
}

export type paymentConfirmInput = {
    transaction_id: string
    status?: Exclude<paymentStatus, "PENDING"> | undefined
    raw_response?: Record<string, unknown> | undefined
}