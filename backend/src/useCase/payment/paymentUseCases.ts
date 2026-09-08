import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import { paymentEntity } from "../../domain/entities/paymentEntity";
import type { paymentType } from "../../domain/types/paymentType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class GetOrderPaymentUseCase {
    constructor(
        private readonly paymentRepository: paymentRepository,
        private readonly orderRepository: orderRepository,
    ) {}

    async execute(orderId: string, userId: string, role: string): Promise<paymentType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.customer.id !== userId && role !== "admin") {
            throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        }
        const payment = await this.paymentRepository.findByOrderId(orderId);
        if (!payment) throw AppError.notFound("Pembayaran belum dibuat untuk pesanan ini");
        return payment;
    }
}

export class ConfirmPaymentUseCase {
    constructor(
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) {}

    async execute(input: unknown, actorUserId: string): Promise<paymentType> {
        const dto = paymentEntity.validateConfirm(input);
        const existing = await this.paymentRepository.findByTransactionId(dto.transaction_id);
        if (!existing) throw AppError.notFound("Pembayaran tidak ditemukan");
        if (existing.status === "PAID") {
            throw AppError.conflict("Pembayaran sudah diverifikasi");
        }
        const confirmed = await this.paymentRepository.confirm({
            ...dto,
            status: dto.status ?? "PAID",
            raw_response: { ...(dto.raw_response ?? {}), confirmedBy: actorUserId },
        });
        if (!confirmed) throw AppError.notFound("Pembayaran tidak ditemukan");

        if (confirmed.status === "PAID") {
            await this.cashflowRepository.create({
                order_id: confirmed.order_id,
                type: "income",
                category: "sales",
                amount: Number(confirmed.gross_amount),
                description: `Pembayaran ${confirmed.payment_type} diverifikasi (${confirmed.transaction_id})`,
            });
            logger.info("payment confirmed", {
                orderId: confirmed.order_id,
                transactionId: confirmed.transaction_id,
                amount: Number(confirmed.gross_amount),
                actorUserId,
            });
        }
        return confirmed;
    }
}

export class ListUserPaymentsUseCase {
    constructor(private readonly paymentRepository: paymentRepository) {}

    async execute(userId: string): Promise<paymentType[]> {
        const data = await this.paymentRepository.listByUser(userId);
        logger.debug("user payments listed", { userId, count: data.length });
        return data;
    }
}