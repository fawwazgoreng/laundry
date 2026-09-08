import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { paymentConfirmInput, paymentCreateInput, paymentStatus } from "../types/paymentType";

const statuses = ["PENDING", "PAID", "FAILED", "EXPIRED"] as const;
const confirmStatuses = ["PAID", "FAILED", "EXPIRED"] as const;

export class paymentEntity {
    private static readonly createSchema = z.object({
        order_id: z.string().min(1),
        payment_type: z.string().min(1).max(20),
        gross_amount: z.coerce.number().nonnegative(),
        transaction_id: z.string().optional(),
    });

    private static readonly confirmSchema = z.object({
        transaction_id: z.string().min(1),
        status: z.enum(confirmStatuses).optional(),
        raw_response: z.record(z.string(), z.unknown()).optional(),
    });

    static validateCreate(input: unknown): paymentCreateInput {
        return this.parse(this.createSchema, input);
    }

    static validateConfirm(input: unknown): paymentConfirmInput {
        return this.parse(this.confirmSchema, input);
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
            throw AppError.validation(result.error.flatten() as unknown as Record<string, unknown>);
        }
        return result.data;
    }
}