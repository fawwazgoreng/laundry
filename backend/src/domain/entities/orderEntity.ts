import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import { roundMoney, type Money, moneyInputSchema, addMoney, clampMinMoney, multiplyMoney, money, decimalPlacesOf } from "../../lib/money";
import { ORDER_STATUSES, type orderCreateType, type orderKind, type orderStatus, type orderTotalsType, PAYMENT_METHODS } from "../types/orderType";
import type { paymentStatus } from "../types/paymentType";

const ORDER_FLOW = ["BARU", "DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI"] as const;

export class orderEntity {
    private static readonly createSchema = z.object({
        services: z.array(
            z.object({
                laundry_service_id: z.coerce.number().int().positive(),
                qty: z.coerce.number().positive("Berat harus lebih dari 0").refine(
                    (q) => decimalPlacesOf(q) <= 2,
                    { message: "Kuantitas maksimal 2 desimal" },
                ),
                notes: z.string().optional().default(""),
                addons: z.array(
                    z.object({
                        group_code: z.string().trim().min(1, "Grup add-on wajib dipilih"),
                        option_id: z.coerce.number().int().positive(),
                    }),
                ).optional().default([]),
            }),
        ).optional().default([]),
        products: z.array(
            z.object({
                product_id: z.coerce.number().int().positive(),
                qty: z.coerce.number().int().positive(),
                addons: z.array(
                    z.object({
                        group_code: z.string().trim().min(1, "Grup add-on wajib dipilih"),
                        option_id: z.coerce.number().int().positive(),
                    }),
                ).optional().default([]),
            }),
        ).optional().default([]),
        user_address_id: z.coerce.number().int().positive(),
        outlet_id: z.coerce.number().int().positive(),
        distance_km: z.coerce.number().nonnegative().default(0),
        delivery_fee: moneyInputSchema.optional(),
        payment_method: z.enum(PAYMENT_METHODS, { message: "Invalid payment method" }),
        bank: z.enum(["bca", "bni", "bri", "permata", "mandiri"]).optional(),
        notes: z.string().optional(),
    }).refine((data) => data.services.length > 0 || data.products.length > 0, {
        message: "Minimal harus memilih satu layanan / satu produck"
    }).superRefine((value, ctx) => {
        if (value.payment_method === "transfer_bank" && !value.bank) {
            ctx.addIssue({
                code: "custom",
                path: ["bank"],
                message: "Pilih bank untuk metode transfer",
            });
        }
    });

    static validateCreate(input: unknown): orderCreateType {
        const result = this.createSchema.safeParse(input);
        if (!result.success) {
            throw AppError.fromZod(result.error);
        }
        const data = result.data as orderCreateType;
        if (!data.services.length && !data.products.length) {
            throw AppError.validation({ detail: "Pesanan harus berisi layanan atau produk" });
        }
        return data;
    }

    static validateStatus(value: unknown): orderStatus {
        if (typeof value !== "string" || !(ORDER_STATUSES as readonly string[]).includes(value)) {
            throw AppError.validation({ status: "Status tidak valid" });
        }
        return value as orderStatus;
    }

    static assertTransition(current: orderStatus, next: orderStatus): void {
        if (current === next) return;
        if (current === "SELESAI") {
            throw AppError.conflict("Pesanan sudah selesai, status tidak dapat diubah");
        }
        if (current === "DIBATALKAN") {
            throw AppError.conflict("Pesanan yang dibatalkan tidak dapat dilanjutkan");
        }
        if (next === "DIBATALKAN" && this.canCancel(current)) return;
        const idx = (ORDER_FLOW as readonly string[]).indexOf(current);
        if (idx < 0 || (ORDER_FLOW as readonly string[])[idx + 1] !== next) {
            throw AppError.conflict("Transisi status tidak valid, ikuti alur: BARU → DITERIMA → DIPROSES → SIAP_ANTAR → SELESAI");
        }
    }

    static canCancel(current: orderStatus): boolean {
        return current === "BARU" || current === "DITERIMA";
    }

    static deriveKind(serviceCount: number, productCount: number): orderKind {
        return productCount > 0 && serviceCount === 0 ? "PRODUCT" : "SERVICE";
    }

    static isRefundEligible(kind: orderKind, method: string, status: string | paymentStatus | null): boolean {
        return kind === "PRODUCT" && method !== "cod" && status === "PAID";
    }

    static generateOrderId(seq: number, date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `CLN-${y}${m}${d}-${String(seq).padStart(3, "0")}`;
    }

    static datePrefix(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `CLN-${y}${m}${d}-`;
    }

    static computeTotals(input: {
        laundrySubtotal: Money
        productSubtotal: Money
        itemCount: number
        deliveryFee: Money
        addonSubtotal?: Money
    }): orderTotalsType {
        const total = clampMinMoney(
            addMoney(input.laundrySubtotal, input.productSubtotal, roundMoney(input.deliveryFee)),
            0,
        );
        return {
            total_laundry: input.laundrySubtotal,
            total_product: input.productSubtotal,
            total_addon: input.addonSubtotal ?? money(0),
            delivery_fee: roundMoney(input.deliveryFee),
            total_amount: total,
            item_count: input.itemCount,
        };
    }

    static computeDeliveryFee(distanceKm: number): Money {
        if (distanceKm <= 0) return money(0);
        return roundMoney(multiplyMoney(distanceKm, 2000));
    }
}