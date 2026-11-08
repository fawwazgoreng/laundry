import { orderEntity } from "../../../domain/entities/orderEntity";
import type { cashflowRepository } from "../../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../../domain/repositories/paymentRepository";
import type { orderDetailType, orderStatus } from "../../../domain/types/orderType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";

export class UpdateOrderStatusUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) { }

    async execute(orderId: string, input: unknown, actorUserId: string): Promise<orderDetailType> {
        const { status } = input as { status: unknown };
        const next = orderEntity.validateStatus(status);

        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        orderEntity.assertTransition(order.status, next);

        const notes = this.statusNote(next);
        await this.orderRepository.updateStatus(orderId, next);
        await this.orderRepository.addTracking(orderId, next, notes);
        logger.info("order status updated", {
            orderId,
            actorUserId,
            from: order.status,
            to: next,
        });

        if (next === "SELESAI") {
            const pending = order.payment;
            if (pending && pending.status === "PENDING") {
                const confirmed = await this.paymentRepository.confirm({
                    transaction_id: pending.transaction_id,
                    status: "PAID",
                    raw_response: { confirmedBy: "admin-status-update" },
                });
                if (confirmed && confirmed.raw_response && (confirmed.raw_response as { confirmedBy?: string }).confirmedBy) {
                    await this.cashflowRepository.create({
                        order_id: orderId,
                        type: "income",
                        category: "sales",
                        amount: order.total_amount,
                        description: `Pembayaran ${order.payment_method} untuk order ${orderId} (SELESAI)`,
                    });
                }
            }
        }

        const fresh = await this.orderRepository.findByOrderId(orderId);
        return fresh ?? order;
    }

    private statusNote(status: orderStatus): string {
        switch (status) {
            case "BARU": return "Pesanan diterima, menunggu konfirmasi outlet.";
            case "DITERIMA": return "Pakaian telah diterima staf di outlet.";
            case "DIPROSES": return "Pakaian sedang dicuci dengan detergen pilihan.";
            case "SIAP_ANTAR": return "Pakaian siap dikemas dan diserahkan ke kurir.";
            case "SELESAI": return "Pakaian bersih telah sampai ke pelanggan. Terima kasih!";
            case "DIBATALKAN": return "Pesanan dibatalkan.";
        }
    }
}
