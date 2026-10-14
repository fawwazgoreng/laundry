export type paymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface paymentType {
    id: string
    order_id: string
    transaction_id: string
    payment_type: string
    gross_amount: number
    status: paymentStatus
    va_number?: string | null
    paid_at: string | null
    raw_response?: Record<string, unknown> | null
    created_at?: string
}

export type paymentCreateInput = {
    order_id: string
    payment_type: string
    gross_amount: number
    transaction_id?: string
    va_number?: string
}

export type paymentConfirmInput = {
    transaction_id: string
    status?: Exclude<paymentStatus, "PENDING">
    raw_response?: Record<string, unknown>
}