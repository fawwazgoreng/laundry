import { refundEntity } from "../../domain/entities/refundEntity";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { refundRepository } from "../../domain/repositories/refundRepository";
import type { refundStatus, refundType } from "../../domain/types/refundType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

const ACTIVE_REFUND_STATUSES: refundStatus[] = ["REQUESTED", "APPROVED", "REFUNDED"];

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

export class DecideRefundUseCase {
    constructor(
        private readonly refundRepository: refundRepository,
        private readonly orderRepository: orderRepository,
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) { }

    async execute(id: string, input: unknown, actorUserId: string): Promise<refundType> {
        const dto = refundEntity.validateDecision(input);
        const refund = await this.refundRepository.findById(id);
        if (!refund) throw AppError.notFound("Pengajuan refund tidak ditemukan");
        if (refund.status !== "REQUESTED") {
            throw AppError.conflict("Pengajuan refund ini sudah diproses");
        }

        if (dto.status === "REJECTED") {
            const rejected = await this.refundRepository.updateStatus(id, {
                status: "REJECTED",
                processed_by: actorUserId,
                processed_at: new Date().toISOString(),
                gateway_response: dto.note ? { note: dto.note } : null,
            });
            logger.info("refund rejected", { refundId: id, actorUserId });
            return rejected ?? { ...refund, status: "REJECTED" };
        }

        const order = await this.orderRepository.findByOrderId(refund.order_id);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        refundEntity.assertProductOnly(order);
        if (!order.payment || order.payment.status !== "PAID") {
            throw AppError.conflict("Pembayaran tidak dapat direfund karena statusnya bukan PAID");
        }
        if (order.payment_method === "cod") {
            throw AppError.conflict("Refund gateway tidak tersedia untuk pembayaran COD");
        }

        let gatewayRef: string | null = null;
        let gatewayResponse: Record<string, unknown> | null = null;
        if (order.payment_method === "transfer_bank") {
            const transactionId = order.payment.transaction_id;
            if (!transactionId) throw AppError.conflict("Transaksi gateway tidak ditemukan");
            await this.cashflowRepository.create({
                order_id: order.id,
                type: "expense",
                category: "refund",
                amount: order.total_amount,
                description: `Customer ${order.customer.username} melakukan refund sejumlah ${order.total_amount}`
            })
        }

        await this.paymentRepository.updateStatus(order.payment.id, "REFUNDED");
        try {
            await this.cashflowRepository.create({
                order_id: order.order_id,
                type: "expense",
                category: "refund",
                amount: refund.amount,
                description: `Refund order ${order.order_id} (${order.payment_method})`,
            });
        } catch (error) {
            logger.warn("refund cashflow already exists or failed to record", {
                refundId: id,
                orderId: order.order_id,
                message: error instanceof Error ? error.message : String(error),
            });
        }

        const updated = await this.refundRepository.updateStatus(id, {
            status: "REFUNDED",
            gateway_ref: gatewayRef,
            gateway_response: gatewayResponse ?? (dto.note ? { note: dto.note } : null),
            processed_by: actorUserId,
            processed_at: new Date().toISOString(),
        });
        logger.info("refund completed", {
            refundId: id,
            orderId: order.order_id,
            actorUserId,
            amount: refund.amount,
            gatewayRef,
        });
        return updated ?? { ...refund, status: "REFUNDED", gateway_ref: gatewayRef };
    }
}
