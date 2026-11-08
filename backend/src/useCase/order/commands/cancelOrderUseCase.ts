import { orderEntity } from "../../../domain/entities/orderEntity";
import type { cashflowRepository } from "../../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../../domain/repositories/paymentRepository";
import type { orderDetailType } from "../../../domain/types/orderType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";

export class CancelOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly cashflowRepository: cashflowRepository,
        private readonly paymentRepository: paymentRepository,
    ) { }

    async execute(orderId: string, userId: string): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.customer.id !== userId) throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        if (!orderEntity.canCancel(order.status)) {
            throw AppError.conflict("Pesanan yang sedang berjalan tidak dapat dibatalkan");
        }
        if (order.payment_method == "transfer_bank" && order.payment) {
            console.log(order.payment)
            await this.paymentRepository.updateStatus(order.payment.id, "DIBATALKAN")
        }
        await this.orderRepository.updateStatus(orderId, "DIBATALKAN");
        await this.orderRepository.addTracking(orderId, "DIBATALKAN", "Pesanan dibatalkan oleh pelanggan.");
        await this.reversePayment(order);
        logger.info("order cancelled by customer", { orderId, userId });
        const fresh = await this.orderRepository.findByOrderId(orderId);
        return fresh ?? order;
    }

    private async reversePayment(order: orderDetailType): Promise<void> {
        if (order.payment && order.payment.status === "PAID") {
            await this.cashflowRepository.create({
                order_id: order.order_id,
                type: "expense",
                category: "refund",
                amount: order.total_amount,
                description: `Refund pembatalan order ${order.order_id} (${order.payment_method})`,
            });
        }
    }
}
