import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { orderDetailType } from "../../../domain/types/orderType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";

export class GetOrderUseCase {
    constructor(private readonly orderRepository: orderRepository) { }

    async execute(orderId: string, userId: string, role: string): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.customer.id !== userId && role !== "admin") {
            logger.warn("order access denied", { requestUserId: userId, orderId });
            throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        }
        return order;
    }
}
