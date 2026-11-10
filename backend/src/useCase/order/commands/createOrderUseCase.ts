import { orderEntity } from "../../../domain/entities/orderEntity";
import type { addressRepository } from "../../../domain/repositories/addressRepository";
import type { cashflowRepository } from "../../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { outletRepository } from "../../../domain/repositories/outletRepository";
import type { paymentRepository } from "../../../domain/repositories/paymentRepository";
import type { productRepository } from "../../../domain/repositories/productRepository";
import type { serviceRepository } from "../../../domain/repositories/serviceRepository";
import type {
    orderDetailType,
    orderNewCashflowType,
    orderNewPaymentType,
    orderStatus,
    paymentGate,
    paymentMethod,
    serviceAddonRecord,
    serviceAddonInput,
} from "../../../domain/types/orderType";
import { addMoney, money, moneySum, multiplyMoney, type Money, roundMoney } from "../../../lib/money";
import type { patchType } from "../../../domain/types/globalType";
import type { serviceAddonGroupType } from "../../../domain/types/serviceType";
import { AppError } from "../../../helper/errorHandling/appError";
import { logger } from "../../../helper/logging/logger";
import { env } from "../../../config/env";
import * as midtransClient from "midtrans-client";

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

export type gatewayCharge = patchType<{
    transaction_id: string
    va_number: string
    raw_response: Record<string, unknown>
}>;

export const ACTIVE_PAYMENT_WINDOW_HOURS = 24;

function isDuplicateOrderId(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        (("code" in error && error.code === "P2002") ||
            ("sqlState" in error && error.sqlState === "23505"))
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

        // Add-on per_order hanya ditagih sekali per pesanan. Set dipakai untuk
        // mendeteksi tabrakan antar item (layanan maupun produk) dan mengikat
        // pilihan tersebut ke item pertama yang memilihnya.
        const perOrderAddonKeys = new Set<string>();
        const perOrderGroupCodes = new Set<string>();

        let laundrySubtotal: Money = money(0);
        let addonSubtotal: Money = money(0);
        const services: Array<{
            laundry_service_id: number
            qty: number
            notes: string
            price_per_unit: Money
            addon_subtotal: Money
            addons: serviceAddonRecord[]
            subtotal: Money
        }> = [];
        for (const item of dto.services) {
            const svc = await this.serviceRepository.findById(item.laundry_service_id);
            if (!svc) throw AppError.notFound(`Layanan id ${item.laundry_service_id} tidak ditemukan`);
            if (!svc.is_active) throw AppError.conflict("Layanan tidak tersedia");
            const addons = this.resolveAddons(svc.addon_groups, item.addons ?? [], item.qty, perOrderAddonKeys, perOrderGroupCodes);
            const itemAddonSubtotal = moneySum(addons.map((addon) => addon.subtotal));
            const subtotal = addMoney(multiplyMoney(svc.price_per_unit, item.qty), itemAddonSubtotal);
            laundrySubtotal = addMoney(laundrySubtotal, subtotal);
            addonSubtotal = addMoney(addonSubtotal, itemAddonSubtotal);
            services.push({
                laundry_service_id: item.laundry_service_id,
                qty: item.qty,
                notes: item.notes ?? "",
                price_per_unit: svc.price_per_unit,
                addon_subtotal: itemAddonSubtotal,
                addons,
                subtotal,
            });
        }

        let productSubtotal: Money = money(0);
        const products: Array<{
            product_id: number
            qty: number
            addons: serviceAddonRecord[]
            subtotal: Money
        }> = [];
        for (const item of dto.products) {
            const prod = await this.productRepository.findById(item.product_id);
            if (!prod) throw AppError.notFound(`Produk id ${item.product_id} tidak ditemukan`);
            if (!prod.is_active) throw AppError.conflict("Produk tidak tersedia");
            if (prod.stock < item.qty) throw AppError.conflict(`Stok ${prod.name} tidak mencukupi`);
            const addons = this.resolveAddons(prod.addon_groups, item.addons ?? [], item.qty, perOrderAddonKeys, perOrderGroupCodes);
            const itemAddonSubtotal = moneySum(addons.map((addon) => addon.subtotal));
            const subtotal = addMoney(multiplyMoney(prod.price, item.qty), itemAddonSubtotal);
            productSubtotal = addMoney(productSubtotal, subtotal);
            products.push({
                product_id: item.product_id,
                qty: item.qty,
                addons,
                subtotal,
            });
        }

        const deliveryFee = orderEntity.computeDeliveryFee(dto.distance_km);
        const totals = orderEntity.computeTotals({
            laundrySubtotal,
            productSubtotal,
            addonSubtotal,
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

    private resolveAddons(
        groups: serviceAddonGroupType[],
        selections: serviceAddonInput[],
        serviceQty: number,
        perOrderAddonKeys: Set<string>,
        perOrderGroupCodes: Set<string>,
    ): serviceAddonRecord[] {
        const activeGroups = groups.filter((group) => group.is_active);
        const groupsByCode = new Map(activeGroups.map((group) => [group.code, group]));
        const selectionsByGroup = new Map<string, serviceAddonInput[]>();

        for (const selection of selections) {
            const group = groupsByCode.get(selection.group_code);
            if (!group) {
                throw AppError.validation({
                    addons: `Add-on ${selection.group_code} tidak tersedia untuk item ini`,
                });
            }
            const option = group.options.find(
                (candidate) => candidate.id === selection.option_id && candidate.is_active,
            );
            if (!option) {
                throw AppError.validation({
                    addons: `Pilihan ${group.name} tidak valid`,
                });
            }
            const picked = selectionsByGroup.get(group.code) ?? [];
            if (picked.some((item) => item.option_id === selection.option_id)) {
                throw AppError.validation({ addons: `Pilihan ${group.name} duplikat` });
            }
            if (group.selection_type === "single" && picked.length > 0) {
                throw AppError.validation({
                    addons: `${group.name} hanya dapat dipilih satu`,
                });
            }
            picked.push(selection);
            selectionsByGroup.set(group.code, picked);
        }

        for (const group of activeGroups) {
            const satisfiedAtOrderLevel = perOrderGroupCodes.has(group.code);
            if (group.is_required && !selectionsByGroup.has(group.code) && !satisfiedAtOrderLevel) {
                throw AppError.validation({ addons: `${group.name} wajib dipilih` });
            }
        }

        const records: serviceAddonRecord[] = [];
        for (const [groupCode, picked] of selectionsByGroup) {
            const group = groupsByCode.get(groupCode)!;
            for (const selection of picked) {
                const option = group.options.find((candidate) => candidate.id === selection.option_id)!;
                if (option.price_mode === "per_order") {
                    const key = `${group.code}:${option.id}`;
                    if (perOrderAddonKeys.has(key)) continue;
                    perOrderAddonKeys.add(key);
                    perOrderGroupCodes.add(group.code);
                }
                const qty = option.price_mode === "per_unit" ? serviceQty : 1;
                records.push({
                    addon_option_id: option.id,
                    group_code: group.code,
                    group_name: group.name,
                    option_name: option.name,
                    price: option.price,
                    price_mode: option.price_mode,
                    qty,
                    subtotal: multiplyMoney(option.price, qty),
                });
            }
        }
        return records.sort((a, b) => a.group_code.localeCompare(b.group_code) || a.option_name.localeCompare(b.option_name));
    }

    private buildInitialPayment(method: paymentMethod, amount: Money): orderNewPaymentType {
        if (method === "fadarosipay" || method === "cod") {
            return {
                payment_type: method,
                gross_amount: amount,
                status: "PENDING",
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

    private buildInitialCashflow(method: paymentMethod, amount: Money, orderId: string): orderNewCashflowType | null {
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
