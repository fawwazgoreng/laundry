import type { paymentConfirmInput, paymentCreateInput, paymentType } from "../types/paymentType";

export interface paymentRepository {
    create(input: paymentCreateInput): Promise<paymentType>
    findByTransactionId(transactionId: string): Promise<paymentType | null>
    findByOrderId(orderId: string): Promise<paymentType | null>
    confirm(input: paymentConfirmInput): Promise<paymentType | null>
    listByUser(userId: string): Promise<paymentType[]>
    findActivePendingByUser(userId: string): Promise<paymentType | null>
    listPendingOlderThan(hours: number): Promise<paymentType[]>
    updateStatus(id: string, status: string): Promise<paymentType | null>
    saveRawResponse(id: string, rawResponse: Record<string, unknown>): Promise<paymentType | null>
    attachGatewayDetails(id: string, details: {
        transaction_id?: string
        va_number?: string | null
        raw_response?: Record<string, unknown> | null
    }): Promise<paymentType | null>
}