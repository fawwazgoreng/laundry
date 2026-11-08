import type { Money } from "../../lib/money";

export const REFUND_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "REFUNDED"] as const;
export type refundStatus = (typeof REFUND_STATUSES)[number];

export type refundCreateInput = {
    order_id: string
    reason: string
}

export type refundDecisionInput = {
    status: "APPROVED" | "REJECTED"
    note?: string | undefined
}

export type refundCreateType = {
    order_id: string
    user_id: string
    payment_id?: string | null
    amount: Money
    reason: string
    status?: refundStatus | undefined
}

export type refundUpdateType = {
    status: refundStatus
    gateway_ref?: string | null | undefined
    gateway_response?: Record<string, unknown> | null | undefined
    processed_by?: string | null | undefined
    processed_at?: string | null | undefined
}

export interface refundSummaryType {
    id: string
    status: refundStatus
    amount: Money
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
