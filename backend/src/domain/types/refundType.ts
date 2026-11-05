export const REFUND_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "REFUNDED"] as const;
export type refundStatus = (typeof REFUND_STATUSES)[number];

export type refundCreateInput = {
    order_id: string
    reason: string
}

export type refundDecisionInput = {
    status: "APPROVED" | "REJECTED"
    note?: string
}

export type refundCreateType = {
    order_id: string
    user_id: string
    payment_id?: string | null
    amount: number
    reason: string
    status?: refundStatus
}

export type refundUpdateType = {
    status: refundStatus
    gateway_ref?: string | null
    gateway_response?: Record<string, unknown> | null
    processed_by?: string | null
    processed_at?: string | null
}

export interface refundSummaryType {
    id: string
    status: refundStatus
    amount: number
    reason: string
    gateway_ref: string | null
    requested_at: string
    processed_at: string | null
}

export interface refundType extends refundSummaryType {
    order_id: string
    user_id: string
    payment_id: string | null
}
