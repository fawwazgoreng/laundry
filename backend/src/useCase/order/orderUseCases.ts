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
    orderNewCashflowType,
    orderNewPaymentType,
    orderStatus,
    paymentGate,
    paymentMethod,
} from "../../domain/types/orderType";
import type { meta } from "../../domain/types/globalType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";
import { env } from "../../config/env";
import * as midtransClient from "midtrans-client";

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
        (("code" in error && error.code === "P2002") ||
            ("sqlState" in error && error.sqlState === "23505"))
    );
}

export type coreChargeResponse = {
    transaction_id?: string
    order_id?: string
    gross_amount?: string
    payment_type?: string
    transaction_time?: string
    transaction_status?: string
    va_numbers?: Array<{ bank: string; va_number: string }>
    permata_va_number?: string
    bill_key?: string
    biller_code?: string
    [key: string]: unknown
};

export interface midtransCoreApiClient {
    charge(parameter: Record<string, unknown>): Promise<coreChargeResponse>
    cancelTransaction(orderId: string): Promise<Record<string, unknown>>
}

export function defaultMidtransCoreApi(): midtransCoreApiClient {
    return new midtransClient.CoreApi({
        clientKey: env.MIDTRANS_CLIENT_KEY,
        isProduction: env.NODE_ENV === "production",
        serverKey: env.MIDTRANS_SERVER_KEY,
    }) as unknown as midtransCoreApiClient;
}

export type gatewayCharge = {
    transaction_id?: string
    va_number?: string
    raw_response?: Record<string, unknown>
};

export const ACTIVE_PAYMENT_WINDOW_HOURS = 24;

export class CreateOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly serviceRepository: serviceRepository,
        private readonly productRepository: productRepository,
        private readonly addressRepository: addressRepository,
        private readonly outletRepository: outletRepository,
        private readonly paymentRepository: paymentRepository,
        private readonly cashflowRepository: cashflowRepository,
        private readonly coreApi: midtransCoreApiClient = defaultMidtransCoreApi(),
    ) { }

    async execute(userId: string, input: unknown): Promise<paymentGate> {
        const dto = orderEntity.validateCreate(input);
        if (dto.payment_method == "transfer_bank") {
            await this.assertNoActivePending(userId);
        }

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

        const initialStatus: orderStatus = dto.payment_method === "cod" ? "DITERIMA" : "BARU";
        const initialTrackingNote =
            initialStatus === "DITERIMA"
                ? "Pakaian telah diterima staf di outlet."
                : "Pesanan diterima. Menunggu konfirmasi outlet.";

        const initialPayment = this.buildInitialPayment(dto.payment_method, totals.total_amount);

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
                    status: initialStatus,
                    tracking: { status: initialStatus, notes: initialTrackingNote },
                    payment: initialPayment,
                    cashflow: this.buildInitialCashflow(dto.payment_method, totals.total_amount, orderId),
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

        if (!order) throw AppError.internal("Gagal membuat pesanan", { orderId });

        let gateway: gatewayCharge | null = null;
        if (dto.payment_method === "transfer_bank") {
            try {
                gateway = await this.chargeBankTransfer(order, dto.bank!);
                if (order.payment && gateway) {
                    await this.paymentRepository.attachGatewayDetails(order.payment.id, {
                        transaction_id: gateway.transaction_id,
                        va_number: gateway.va_number ?? null,
                        raw_response: gateway.raw_response ?? null,
                    });
                }
            } catch (error) {
                await this.compensateFailedCharge(order);
                throw error;
            }
        }

        logger.info("order created", {
            requestUserId: userId,
            orderId,
            totalAmount: totals.total_amount,
            paymentMethod: dto.payment_method,
            serviceCount: services.length,
            productCount: products.length,
        });
        return {
            redirect_url: "",
            token: "",
            order_id: orderId,
            va_number: gateway?.va_number,
        }
    }

    private buildInitialPayment(method: paymentMethod, amount: number): orderNewPaymentType {
        if (method === "fadarosipay" || method === "cod") {
            return {
                payment_type: method,
                gross_amount: amount,
                status: "PAID",
                paid_at: new Date().toISOString(),
                raw_response: { gateway: "fadarosipay", method: "wallet" },
            };
        }
        return {
            payment_type: method,
            gross_amount: amount,
            status: "PENDING",
        };
    }

    private buildInitialCashflow(method: paymentMethod, amount: number, orderId: string): orderNewCashflowType | null {
        if (method !== "fadarosipay") return null;
        return {
            type: "income",
            category: "sales",
            amount,
            description: `Pembayaran FADAROSI Pay untuk order ${orderId}`,
        };
    }

    private async compensateFailedCharge(order: orderDetailType): Promise<void> {
        try {
            if (order.payment) {
                await this.paymentRepository.updateStatus(order.payment.id, "FAILED");
            }
            await this.orderRepository.updateStatus(order.order_id, "DIBATALKAN");
            await this.orderRepository.addTracking(
                order.order_id,
                "DIBATALKAN",
                "Pembayaran gagal dibuat, pesanan dibatalkan otomatis.",
            );
        } catch (error) {
            logger.error("failed to compensate after gateway charge failure", {
                orderId: order.order_id,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async assertNoActivePending(userId: string): Promise<void> {
        const active = await this.paymentRepository.findActivePendingByUser(userId);
        if (!active || !active.created_at) return;

        const createdAt = new Date(active.created_at);
        const expiresAt = new Date(createdAt.getTime() + ACTIVE_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);
        const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        if (remainingSeconds <= 0) return;

        throw AppError.conflict(
            `Anda masih memiliki pesanan ${active.order_id} yang menunggu pembayaran. Selesaikan atau tunggu batas waktunya.`,
            {
                order_id: active.order_id,
                created_at: createdAt.toISOString(),
                expires_at: expiresAt.toISOString(),
                remaining_seconds: remainingSeconds,
            },
        );
    }

    private async chargeBankTransfer(order: orderDetailType, bank: string): Promise<gatewayCharge> {
        const response = await this.coreApi.charge({
            transaction_details: {
                order_id: order.order_id,
                gross_amount: order.total_amount,
            },
            payment_type: "bank_transfer",
            bank_transfer: { bank },
            customer_details: {
                first_name: order.customer.username,
                last_name: "",
                email: order.customer.email ?? "",
                phone: order.customer.phone ?? "",
            },
        });

        const vaNumber = response.permata_va_number ?? response.va_numbers?.[0]?.va_number ?? "";
        logger.info("midtrans bank transfer charged", {
            orderId: order.order_id,
            bank,
            transactionId: response.transaction_id,
            hasVaNumber: Boolean(vaNumber),
            expiresInHours: ACTIVE_PAYMENT_WINDOW_HOURS,
        });

        return {
            transaction_id: response.transaction_id,
            va_number: vaNumber,
            raw_response: response as Record<string, unknown>,
        };
    }
}

export class ListOrdersUseCase {
    constructor(private readonly orderRepository: orderRepository) { }

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

export class DeleteOrderUseCase {
    constructor(
        private readonly orderRepository: orderRepository,
        private readonly cashflowRepository: cashflowRepository,
    ) { }

    async execute(
        orderId: string,
        actorUserId: string,
        actorRole: "admin" | "user" = "admin",
    ): Promise<orderDetailType> {
        const order = await this.orderRepository.findByOrderId(orderId);
        if (!order) throw AppError.notFound("Pesanan tidak ditemukan");

        const isAdmin = actorRole === "admin";
        const isOwner = order.customer.id === actorUserId;

        if (order.status === "DIBATALKAN") {
            if (!isAdmin && !isOwner) {
                throw AppError.forbidden("Anda tidak memiliki akses ke pesanan ini");
            }
            await this.orderRepository.delete(orderId);
            logger.warn("cancelled order deleted", { orderId, actorUserId, actorRole });
            return order;
        }

        if (!isAdmin) {
            throw AppError.forbidden("Hanya admin yang dapat menghapus pesanan aktif");
        }
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