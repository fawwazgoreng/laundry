import { refundEntity } from "../../../domain/entities/refundEntity";
import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { refundRepository } from "../../../domain/repositories/refundRepository";
import type { refundStatus, refundType } from "../../../domain/types/refundType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";

export const ACTIVE_REFUND_STATUSES: refundStatus[] = ["REQUESTED", "APPROVED", "REFUNDED"];

export class CreateRefundUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly refundRepository: refundRepository,
    ) { }

    async execute(userId: string, input: unknown): Promise<refundType> {
        const dto = refundEntity.validateCreate(input);
        const order = await this.orderRepository.findByOrderId(dto.order_id);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.customer.id !== userId) {
            throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        }

        refundEntity.assertRequestable(order);

        const existing = await this.refundRepository.findLatestByOrderId(order.order_id);
        if (existing && ACTIVE_REFUND_STATUSES.includes(existing.status)) {
            throw AppError.conflict("Pesanan ini sudah memiliki pengajuan refund");
        }

        const refund = await this.refundRepository.create({
            order_id: order.order_id,
            user_id: userId,
            payment_id: order.payment?.id ?? null,
            amount: order.payment?.gross_amount ?? order.total_amount,
            reason: dto.reason,
            status: "REQUESTED",
        });
        logger.info("refund requested", {
            refundId: refund.id,
            orderId: refund.order_id,
            userId,
            amount: refund.amount,
        });
        return refund;
    }
}
