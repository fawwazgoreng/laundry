import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { orderDetailType } from "../types/orderType";
import type { refundCreateInput, refundDecisionInput } from "../types/refundType";

export class refundEntity {
    private static readonly createSchema = z.object({
        order_id: z.string().trim().min(1, "Order wajib dipilih").max(50),
        reason: z.string().trim().min(10, "Alasan refund minimal 10 karakter").max(500, "Alasan maksimal 500 karakter"),
    });

    private static readonly decisionSchema = z.object({
        status: z.enum(["APPROVED", "REJECTED"], { message: "Keputusan refund tidak valid" }),
        note: z.string().trim().max(500).optional(),
    });

    static validateCreate(input: unknown): refundCreateInput {
        const result = this.createSchema.safeParse(input);
        if (!result.success) throw AppError.fromZod(result.error);
        return result.data;
    }

    static validateDecision(input: unknown): refundDecisionInput {
        const result = this.decisionSchema.safeParse(input);
        if (!result.success) throw AppError.fromZod(result.error);
        return result.data;
    }

    static assertProductOnly(order: orderDetailType): void {
        if (order.order_type !== "PRODUCT") {
            throw AppError.conflict("Refund hanya dapat dilakukan untuk order bertipe Product");
        }
    }

    static assertPaymentRefundable(order: orderDetailType): void {
        if (!order.payment || order.payment.status !== "PAID") {
            throw AppError.conflict("Refund hanya dapat diajukan untuk pembayaran yang sudah lunas");
        }
        if (order.payment_method === "cod") {
            throw AppError.conflict("Refund online hanya tersedia untuk pembayaran melalui gateway");
        }
    }

    static assertRequestable(order: orderDetailType): void {
        if (order.status === "DIBATALKAN") {
            throw AppError.conflict("Pesanan yang dibatalkan tidak dapat diajukan refund");
        }
        this.assertProductOnly(order);
        this.assertPaymentRefundable(order);
    }
}
