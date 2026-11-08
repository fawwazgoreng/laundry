import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { orderDetailType } from "../../../domain/types/orderType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";

export class DeleteOrderUseCase {
    constructor(private readonly orderRepository: orderRepository) { }

    async execute(
        orderId: string,
        actorUserId: string,
        actorRole: "admin" | "user" = "admin",
    ): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");

        const isAdmin = actorRole === "admin";
        const isOwner = order.customer.id === actorUserId;
        if (!isAdmin && !isOwner) {
            throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        }
        if (order.status !== "SELESAI" && order.status !== "DIBATALKAN") {
            throw AppError.conflict("Hanya pesanan berstatus SELESAI/DIBATALKAN yang dapat dihapus");
        }

        await this.orderRepository.delete(orderId);
        logger.warn("order deleted", { orderId, actorUserId, actorRole, status: order.status });
        return order;
    }
}
