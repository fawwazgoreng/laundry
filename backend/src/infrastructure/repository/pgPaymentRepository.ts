import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { paymentGatewayDetails } from "../../domain/repositories/paymentRepository";
import type { paymentConfirmInput, paymentCreateInput, paymentType } from "../../domain/types/paymentType";
import { logger } from "../../helper/logging/logger";
import { prisma } from "../prisma/prisma";
import { fromJsonText, jsonText, numeric, varchar } from "../prisma/scalars";
import type { Models } from "../database/generated/contract";
import { money } from "../../lib/money";

type PaymentRow = Pick<
    Models.Payments,
    "id" | "order_id" | "transaction_id" | "payment_type" | "gross_amount" | "status" | "va_number" | "paid_at" | "raw_response" | "created_at"
>;

function toPaymentType(row: PaymentRow): paymentType {
    return {
        id: row.id,
        order_id: row.order_id,
        transaction_id: row.transaction_id,
        payment_type: row.payment_type,
        gross_amount: money(row.gross_amount),
        status: row.status as paymentType["status"],
        va_number: row.va_number,
        paid_at: row.paid_at ? row.paid_at.toISOString() : null,
        raw_response: fromJsonText(row.raw_response),
        created_at: row.created_at.toISOString(),
    };
}

export class pgPaymentRepository implements paymentRepository {
    async create(input: paymentCreateInput): Promise<paymentType> {
        const row = await prisma.orm.Payments.create({
            order_id: input.order_id,
            transaction_id: input.transaction_id ?? `TRX-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            payment_type: varchar<20>(input.payment_type),
            gross_amount: numeric<12, 2>(input.gross_amount),
            status: varchar<30>("PENDING"),
            va_number: input.va_number ?? null,
            paid_at: null,
            raw_response: null,
        });
        return toPaymentType(row);
    }

    async findByTransactionId(transactionId: string): Promise<paymentType | null> {
        const row = await prisma.orm.Payments.where({ transaction_id: transactionId }).first();
        return row ? toPaymentType(row) : null;
    }

    async findByOrderId(orderId: string): Promise<paymentType | null> {
        const row = await prisma.orm.Payments
            .where({ order_id: orderId })
            .orderBy((r) => r.created_at.desc())
            .first();
        return row ? toPaymentType(row) : null;
    }

    async confirm(input: paymentConfirmInput): Promise<paymentType | null> {
        const existing = await this.findByTransactionId(input.transaction_id);
        if (!existing) return null;
        const status = input.status ?? "PAID";
        const paidAt = status === "PAID" ? new Date() : existing.paid_at ? new Date(existing.paid_at) : null;
        const row = await prisma.orm.Payments
            .where({ id: existing.id })
            .where({ status: varchar<30>("PENDING") })
            .update({
                status: varchar<30>(status),
                paid_at: paidAt,
                raw_response: jsonText(input.raw_response ?? null),
            });
        return row ? toPaymentType(row) : null;
    }

    async listByUser(userId: string): Promise<paymentType[]> {
        const rows = await prisma.orm.Payments
            .where((p) => p.order.some((o) => o.user_id.eq(userId)))
            .orderBy((p) => p.created_at.desc())
            .all();
        return rows.map(toPaymentType);
    }

    async findActivePendingByUser(userId: string): Promise<paymentType | null> {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rows = await prisma.orm.Payments
            .where({ status: varchar<30>("PENDING") })
            .where((p) => p.order.some((o) => o.user_id.eq(userId)))
            .where({ payment_type: varchar<20>("transfer_bank")})
            .orderBy((p) => p.created_at.desc())
            .limit(10)
            .all();
        const row = rows.find((r) => r.created_at > cutoff);
        return row ? toPaymentType(row) : null;
    }

    async listPendingOlderThan(hours: number): Promise<paymentType[]> {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const rows = await prisma.orm.Payments
            .where((p, { fns }) => fns.and(p.status.eq(varchar<30>("PENDING")), p.created_at.lt(cutoff)))
            .all();
        return rows.map(toPaymentType);
    }

    async updateStatus(id: string, status: string): Promise<paymentType | null> {
        try {
            const row = await prisma.orm.Payments
                .where({ id })
                .update({ status: varchar<30>(status) });
            return row ? toPaymentType(row) : null;
        } catch (error) {
            logger.error("failed to update payment status", {
                paymentId: id,
                status,
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async saveRawResponse(id: string, rawResponse: Record<string, unknown>): Promise<paymentType | null> {
        try {
            const row = await prisma.orm.Payments
                .where({ id })
                .update({ raw_response: jsonText(rawResponse) });
            return row ? toPaymentType(row) : null;
        } catch (error) {
            logger.error("failed to save payment raw response", {
                paymentId: id,
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async attachGatewayDetails(id: string, details: paymentGatewayDetails): Promise<paymentType | null> {
        const row = await prisma.orm.Payments
            .where({ id })
            .update({
                ...(details.transaction_id ? { transaction_id: details.transaction_id } : {}),
                ...(details.va_number !== undefined ? { va_number: details.va_number } : {}),
                ...(details.raw_response !== undefined ? { raw_response: jsonText(details.raw_response) } : {}),
            });
        return row ? toPaymentType(row) : null;
    }
}
