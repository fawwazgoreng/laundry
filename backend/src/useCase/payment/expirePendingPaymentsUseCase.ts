import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import { logger } from "../../helper/logging/logger";

export interface midtransCanceller {
    cancelTransaction(orderId: string): Promise<Record<string, unknown>>
}

export const PENDING_PAYMENT_TTL_HOURS = 24;

export class ExpirePendingPaymentsUseCase {
    constructor(
        private readonly paymentRepository: paymentRepository,
        private readonly orderRepository: orderRepository,
        private readonly coreApi: midtransCanceller,
    ) {}

    async execute(): Promise<number> {
        const pending = await this.paymentRepository.listPendingOlderThan(PENDING_PAYMENT_TTL_HOURS);
        if (pending.length === 0) {
            logger.debug("payment expiry worker: no pending payments past TTL");
            return 0;
        }

        let processed = 0;
        for (const payment of pending) {
            try {
                await this.expire(payment.order_id, payment.id, payment.payment_type);
                processed += 1;
            } catch (error) {
                logger.error("failed to expire pending payment", {
                    orderId: payment.order_id,
                    transactionId: payment.transaction_id,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }

        logger.info("payment expiry worker finished", { scanned: pending.length, processed });
        return processed;
    }

    private async expire(orderId: string, paymentId: string, paymentType: string): Promise<void> {
        if (paymentType === "transfer_bank") {
            await this.cancelGateway(orderId);
        }

        await this.paymentRepository.updateStatus(paymentId, "EXPIRED");

        const order = await this.orderRepository.findByOrderId(orderId);
        if (order && order.status !== "DIBATALKAN") {
            await this.orderRepository.updateStatus(order.order_id, "DIBATALKAN");
            await this.orderRepository.addTracking(
                order.order_id,
                "DIBATALKAN",
                "Pesanan dibatalkan otomatis karena pembayaran melewati batas 24 jam.",
            );
        }

        logger.info("pending payment expired", { orderId, paymentId });
    }

    private async cancelGateway(orderId: string): Promise<void> {
        try {
            await this.coreApi.cancelTransaction(orderId);
        } catch (error) {
            logger.warn("midtrans cancelTransaction failed, expiring locally", {
                orderId,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
