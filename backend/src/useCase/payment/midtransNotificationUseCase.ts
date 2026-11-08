import * as midtransClient from "midtrans-client";
import { env } from "../../config/env";
import { paymentEntity } from "../../domain/entities/paymentEntity";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { paymentStatus } from "../../domain/types/paymentType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

type midtransStatusResponse = Record<string, unknown> & {
    transaction_status?: string
    payment_type?: string
    fraud_status?: string
    transaction_id?: string
};

type snapWithTransaction = {
    transaction: {
        status(orderId: string): Promise<Record<string, unknown>>
    }
};

export class HandleMidtransNotificationUseCase {
    constructor(
        private readonly paymentRepository: paymentRepository,
        private readonly orderRepository: orderRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) { }

    async execute(raw: unknown): Promise<void> {
        const dto = paymentEntity.validateNotification(raw);
        
        
        if (!paymentEntity.isValidSignature(dto, env.MIDTRANS_SERVER_KEY)) {
            throw AppError.forbidden("Signature Midtrans tidak valid");
        }
        
        if (dto.order_id.startsWith("payment_notif_test")) {
            logger.info("midtrans test notification acknowledged", { orderId: dto.order_id });
            return;
        }

        const order = await this.orderRepository.findByOrderId(dto.order_id);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");

        const payment = await this.paymentRepository.findByOrderId(dto.order_id);
        if (!payment) throw AppError.notFound("Pembayaran belum dibuat untuk pesanan ini");
        if (payment.payment_type !== "transfer_bank") {
            logger.warn("midtrans notification ignored for non-gateway payment", { orderId: dto.order_id });
            return;
        }

        const statusResponse = await this.fetchStatus(dto.order_id);
        const status = paymentEntity.mapMidtransStatus(statusResponse.transaction_status ?? "");
        if (!status) {
            logger.debug("midtrans transaction status ignored", {
                orderId: dto.order_id,
                transactionStatus: statusResponse.transaction_status,
            });
            return;
        }

        if (payment.status === "PAID") {
            logger.info("midtrans notification ignored, payment already settled", { orderId: dto.order_id });
            return;
        }

        await this.applyStatus(dto.order_id, payment.transaction_id, status, statusResponse);
    }

    private async applyStatus(
        orderId: string,
        transactionId: string,
        status: Exclude<paymentStatus, "PENDING">,
        statusResponse: midtransStatusResponse,
    ): Promise<void> {
        const confirmed = await this.paymentRepository.confirm({
            transaction_id: transactionId,
            status,
            raw_response: statusResponse,
        });

        if (status === "PAID" && confirmed) {
            await this.cashflowRepository.create({
                order_id: orderId,
                type: "income",
                category: "sales",
                amount: confirmed.gross_amount,
                description: `Pembayaran ${statusResponse.payment_type ?? "transfer_bank"} diverifikasi otomatis oleh Midtrans (${orderId})`,
            });
            logger.info("midtrans payment settled", {
                orderId,
                transactionId,
                paymentType: statusResponse.payment_type,
                amount: confirmed.gross_amount,
            });
        } else {
            logger.info("midtrans payment closed", { orderId, transactionId, status });
        }
    }

    private fetchStatus(orderId: string): Promise<midtransStatusResponse> {
        const snap = new midtransClient.Snap({
            isProduction: env.NODE_ENV === "production",
            serverKey: env.MIDTRANS_SERVER_KEY,
            clientKey: env.MIDTRANS_CLIENT_KEY,
        }) as unknown as snapWithTransaction;
        return snap.transaction.status(orderId);
    }
}