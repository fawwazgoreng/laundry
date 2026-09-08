import type { paymentConfirmInput, paymentCreateInput, paymentType } from "../types/paymentType";

export interface paymentRepository {
    create(input: paymentCreateInput): Promise<paymentType>
    findByTransactionId(transactionId: string): Promise<paymentType | null>
    findByOrderId(orderId: string): Promise<paymentType | null>
    confirm(input: paymentConfirmInput): Promise<paymentType | null>
    listByUser(userId: string): Promise<paymentType[]>
}