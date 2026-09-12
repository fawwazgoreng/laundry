import { orderEntity } from "../../domain/entities/orderEntity";
import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { productRepository } from "../../domain/repositories/productRepository";
import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type {
    orderDetailType,
    orderListFilters,
    orderListItemType,
    orderStatus,
} from "../../domain/types/orderType";
import type { meta } from "../../domain/types/globalType";
import type { paymentType } from "../../domain/types/paymentType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

function buildMeta(count: number, page: number, perPage: number): meta {
    return {
        firstPage: 1,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(count / perPage)),
        count,
    };
}

function isDuplicateOrderId(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    );
}

export class CreateOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly serviceRepository: serviceRepository,
        private readonly productRepository: productRepository,
        private readonly addressRepository: addressRepository,
        private readonly outletRepository: outletRepository,
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) {}

    async execute(userId: string, input: unknown): Promise<orderDetailType> {
        const dto = orderEntity.validateCreate(input);

        const address = await this.addressRepository.findById(userId, dto.user_address_id);
        if (!address) throw AppError.notFound("Alamat pengiriman tidak ditemukan");
        const outlet = await this.outletRepository.findById(dto.outlet_id);
        if (!outlet) throw AppError.notFound("Outlet tidak ditemukan");

        let laundrySubtotal = 0;
        const services: Array<{ laundry_service_id: number; qty: number; notes: string; subtotal: number }> = [];
        for (const item of dto.services) {
            const svc = await this.serviceRepository.findById(item.laundry_service_id);
            if (!svc) throw AppError.notFound(`Layanan id ${item.laundry_service_id} tidak ditemukan`);
            if (!svc.is_active) throw AppError.conflict("Layanan tidak tersedia");
            const subtotal = svc.price_per_unit * item.qty;
            laundrySubtotal += subtotal;
            services.push({ ...item, notes: item.notes ?? "", subtotal });
        }

        let productSubtotal = 0;
        const products: Array<{ product_id: number; qty: number; subtotal: number }> = [];
        for (const item of dto.products) {
            const prod = await this.productRepository.findById(item.product_id);
            if (!prod) throw AppError.notFound(`Produk id ${item.product_id} tidak ditemukan`);
            if (!prod.is_active) throw AppError.conflict("Produk tidak tersedia");
            if (prod.stock < item.qty) throw AppError.conflict(`Stok ${prod.name} tidak mencukupi`);
            const subtotal = Number(prod.price) * item.qty;
            productSubtotal += subtotal;
            products.push({ ...item, subtotal });
        }

        const deliveryFee = orderEntity.computeDeliveryFee(dto.distance_km);
        const totals = orderEntity.computeTotals({
            laundrySubtotal,
            productSubtotal,
            itemCount: services.length + products.length,
            deliveryFee,
        });

        let orderId = "";
        let order: orderDetailType | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            const seq = (await this.orderRepository.countByDatePrefix(orderEntity.datePrefix())) + 1;
            orderId = orderEntity.generateOrderId(seq);
            try {
                order = await this.orderRepository.create({
                    order_id: orderId,
                    user_id: userId,
                    outlet_id: dto.outlet_id,
                    user_address_id: dto.user_address_id,
                    distance_km: dto.distance_km,
                    delivery_fee: totals.delivery_fee,
                    payment_method: dto.payment_method,
                    notes: dto.notes,
                    services,
                    products,
                    totals,
                    status: "BARU",
                    tracking: { status: "BARU", notes: "Pesanan diterima. Menunggu konfirmasi outlet." },
                });
                break;
            } catch (error) {
                if (isDuplicateOrderId(error) && attempt < 2) {
                    logger.warn("order id collision, retrying", { orderId, attempt: attempt + 1 });
                    continue;
                }
                throw error;
            }
        }

        if (!order) throw new Error("failed to create order");
        await this.issuePayment(order, dto.payment_method, totals.total_amount);

        const fresh = await this.orderRepository.findByOrderId(orderId);
        logger.info("order created", {
            requestUserId: userId,
            orderId,
            totalAmount: totals.total_amount,
            paymentMethod: dto.payment_method,
            serviceCount: services.length,
            productCount: products.length,
        });
        return fresh ?? order;
    }

    private async issuePayment(order: orderDetailType, method: string, amount: number): Promise<paymentType | null> {
        if (method === "fadarosipay") {
            const payment = await this.paymentRepository.create({
                order_id: order.order_id,
                payment_type: method,
                gross_amount: amount,
            });
            const confirmed = await this.paymentRepository.confirm({
                transaction_id: payment.transaction_id,
                status: "PAID",
                raw_response: { gateway: "fadarosipay", method: "wallet" },
            });
            if (confirmed) {
                await this.cashflowRepository.create({
                    order_id: order.order_id,
                    type: "income",
                    category: "sales",
                    amount,
                    description: `Pembayaran FADAROSI Pay untuk order ${order.order_id}`,
                });
            }
            return confirmed;
        }

        if (method === "transfer_bank") {
            const virtualAccount = `2620${String(Math.floor(100000000000 + Math.random() * 899999999999))}`;
            const payment = await this.paymentRepository.create({
                order_id: order.order_id,
                payment_type: method,
                gross_amount: amount,
                transaction_id: virtualAccount,
            });
            logger.warn("virtual account issued", {
                orderId: order.order_id,
                virtualAccount,
                expiresInHours: 24,
            });
            return payment;
        }

        return this.paymentRepository.create({
            order_id: order.order_id,
            payment_type: "cod",
            gross_amount: amount,
        });
    }
}

export class ListOrdersUseCase {
    constructor(private readonly orderRepository: orderRepository) {}

    async execute(
        userId: string,
        role: string,
        filters: orderListFilters = {},
    ): Promise<{ data: orderListItemType[]; meta: meta }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const result =
            role === "admin"
                ? await this.orderRepository.listAll({ ...filters, page, perPage })
                : await this.orderRepository.listByUser(userId, { ...filters, page, perPage });
        logger.debug("orders listed", {
            requestUserId: userId,
            role,
            count: result.count,
            page,
            perPage,
            filter: filters.status ?? "all",
        });
        return { data: result.data, meta: buildMeta(result.count, page, perPage) };
    }
}

export class GetOrderUseCase {
    constructor(private readonly orderRepository: orderRepository) {}

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

export class UpdateOrderStatusUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) {}

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

export class CancelOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) {}

    async execute(orderId: string, userId: string): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.customer.id !== userId) throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
        if (!orderEntity.canCancel(order.status)) {
            throw AppError.conflict("Pesanan yang sedang berjalan tidak dapat dibatalkan");
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

export class DeleteOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) {}

    async execute(orderId: string, actorUserId: string): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");
        if (order.status !== "BARU" && order.status !== "DITERIMA") {
            throw AppError.conflict("Hanya pesanan berstatus BARU/DITERIMA yang dapat dihapus");
        }
        await this.orderRepository.updateStatus(orderId, "DIBATALKAN");
        await this.orderRepository.addTracking(orderId, "DIBATALKAN", `Pesanan dihapus oleh admin (${actorUserId}).`);
        if (order.payment && order.payment.status === "PAID") {
            await this.cashflowRepository.create({
                order_id: order.order_id,
                type: "expense",
                category: "refund",
                amount: order.total_amount,
                description: `Refund penghapusan order ${order.order_id} (${order.payment_method})`,
            });
        }
        logger.warn("order deleted by admin", { orderId, actorUserId });
        const fresh = await this.orderRepository.findByOrderId(orderId);
        return fresh ?? order;
    }
}