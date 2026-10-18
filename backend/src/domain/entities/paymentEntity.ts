import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { paymentConfirmInput, paymentCreateInput, paymentStatus } from "../types/paymentType";

const statuses = ["PENDING", "PAID", "FAILED", "EXPIRED"] as const;
const confirmStatuses = ["PAID", "FAILED", "EXPIRED"] as const;

export type midtransNotificationInput = {
    order_id: string
    status_code: string
    gross_amount: string
    signature_key: string
    transaction_status?: string
    payment_type?: string
    fraud_status?: string
    va_numbers?: Array<{ bank: string; va_number: string }>
    permata_va_number?: string
    bill_key?: string
    biller_code?: string
    transaction_time?: string
}

export class paymentEntity {
    private static readonly createSchema = z.object({
        order_id: z.string().min(1),
        payment_type: z.string().min(1).max(20),
        gross_amount: z.coerce.number().nonnegative(),
        transaction_id: z.string().optional(),
        va_number: z.string().optional(),
    });

    private static readonly confirmSchema = z.object({
        transaction_id: z.string().min(1),
        status: z.enum(confirmStatuses).optional(),
        raw_response: z.record(z.string(), z.unknown()).optional(),
    });

    private static readonly notificationSchema = z.object({
        order_id: z.string().min(1),
        status_code: z.coerce.string().min(1),
        gross_amount: z.coerce.string().min(1),
        signature_key: z.string().min(1),
        transaction_status: z.string().optional(),
        payment_type: z.string().optional(),
        fraud_status: z.string().optional(),
        va_numbers: z
            .array(z.object({ bank: z.string(), va_number: z.string() }))
            .optional(),
        permata_va_number: z.string().optional(),
        bill_key: z.string().optional(),
        biller_code: z.string().optional(),
        transaction_time: z.string().optional(),
    });

    static validateCreate(input: unknown): paymentCreateInput {
        return this.parse(this.createSchema, input);
    }

    static validateConfirm(input: unknown): paymentConfirmInput {
        return this.parse(this.confirmSchema, input);
    }

    static validateNotification(input: unknown): midtransNotificationInput {
        return this.parse(this.notificationSchema, input);
    }

    static isValidSignature(notification: midtransNotificationInput, serverKey: string): boolean {
        const expected = createHash("sha512")
            .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
            .digest();
        const provided = Buffer.from(notification.signature_key.toLowerCase(), "hex");
        if (provided.length !== expected.length) return false;
        return timingSafeEqual(expected, provided);
    }

    static mapMidtransStatus(transactionStatus: string): Exclude<paymentStatus, "PENDING"> | null {
        switch (transactionStatus) {
            case "settlement":
            case "capture":
                return "PAID";
            case "expire":
                return "EXPIRED";
            case "cancel":
            case "deny":
                return "FAILED";
            default:
                return null;
        }
    }

    static generateTransactionId(prefix: string, orderId: string): string {
        const suffix = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
        return `${prefix}-${suffix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }

    static isValidStatus(value: string): value is paymentStatus {
        return (statuses as readonly string[]).includes(value);
    }

    private static parse<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
        const result = schema.safeParse(input);
        if (!result.success) {
            throw AppError.fromZod(result.error);
        }
        return result.data;
    }
}