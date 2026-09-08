import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import { ORDER_STATUSES, type orderCreateType, type orderStatus, type orderTotalsType, PAYMENT_METHODS } from "../types/orderType";

const ORDER_FLOW = ["BARU", "DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI"] as const;

export class orderEntity {
    private static readonly createSchema = z.object({
        services: z.array(
            z.object({
                laundry_service_id: z.coerce.number().int().positive(),
                qty: z.coerce.number().positive("Berat harus lebih dari 0"),
                notes: z.string().optional().default(""),
            }),
        ).min(1, "Pilih minimal satu layanan laundry"),
        products: z.array(
            z.object({
                product_id: z.coerce.number().int().positive(),
                qty: z.coerce.number().int().positive(),
            }),
        ).optional().default([]),
        user_address_id: z.coerce.number().int().positive(),
        outlet_id: z.coerce.number().int().positive(),
        distance_km: z.coerce.number().nonnegative().default(0),
        delivery_fee: z.coerce.number().nonnegative().optional(),
        payment_method: z.enum(PAYMENT_METHODS, { message: "Invalid payment method" }),
        discount_member: z.coerce.number().nonnegative().optional().default(0),
        discount_voucher: z.coerce.number().nonnegative().optional().default(0),
        pickup_schedule: z.coerce.date().refine((d) => d.getTime() > Date.now(), "Jadwal penjemputan harus di masa depan"),
        estimated_delivery: z.coerce.date().refine((d) => d.getTime() > Date.now(), "Estimasi pengantaran harus di masa depan"),
        notes: z.string().optional(),
    });

    static validateCreate(input: unknown): orderCreateType {
        const result = this.createSchema.safeParse(input);
        if (!result.success) {
            throw AppError.validation(result.error.flatten() as unknown as Record<string, unknown>);
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
        laundrySubtotal: number
        productSubtotal: number
        itemCount: number
        deliveryFee: number
        discountMember: number
        discountVoucher: number
    }): orderTotalsType {
        const total = Math.max(
            0,
            Math.round(input.laundrySubtotal + input.productSubtotal + input.deliveryFee - input.discountMember - input.discountVoucher),
        );
        return {
            total_laundry: Math.round(input.laundrySubtotal),
            total_product: Math.round(input.productSubtotal),
            delivery_fee: Math.round(input.deliveryFee),
            discount_member: Math.round(input.discountMember),
            discount_voucher: Math.round(input.discountVoucher),
            total_amount: total,
            item_count: input.itemCount,
        };
    }

    static computeDeliveryFee(distanceKm: number): number {
        if (distanceKm <= 0) return 0;
        return Math.round(distanceKm * 2000);
    }
}