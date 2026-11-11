import { refundEntity } from "../../../domain/entities/refundEntity";
import type { cashflowRepository } from "../../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../../domain/repositories/paymentRepository";
import type { refundRepository } from "../../../domain/repositories/refundRepository";
import type { refundType } from "../../../domain/types/refundType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";
import { assertRefundEligibility } from "../refundValidator";

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
        assertRefundEligibility({
            order,
            now: new Date(),
            latestRefundStatus: refund.status,
        });
        const payment = order.payment;
        if (!payment) throw AppError.conflict("Pembayaran tidak dapat direfund karena statusnya bukan PAID");

        let gatewayRef: string | null = null;
        let gatewayResponse: Record<string, unknown> | null = null;
        // if (order.payment_method === "transfer_bank") {
        //     const transactionId = payment.transaction_id;
        //     if (!transactionId) throw AppError.conflict("Transaksi gateway tidak ditemukan");
        //     await this.cashflowRepository.create({
        //         order_id: order.id,
        //         type: "expense",
        //         category: "refund",
        //         amount: order.total_amount,
        //         description: `Customer ${order.customer.username} melakukan refund sejumlah ${order.total_amount}`
        //     })
        // }

        await this.paymentRepository.updateStatus(payment.id, "REFUNDED");
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
