import type { refundCreateType, refundType, refundUpdateType } from "../types/refundType";

export interface refundRepository {
    create(input: refundCreateType): Promise<refundType>
    findById(id: string): Promise<refundType | null>
    findLatestByOrderId(orderId: string): Promise<refundType | null>
    updateStatus(id: string, input: refundUpdateType): Promise<refundType | null>
}
