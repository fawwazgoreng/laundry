import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { paymentConfirmInput, paymentCreateInput, paymentType } from "../../domain/types/paymentType";
import { prisma } from "../prisma/prisma";

type PaymentRow = {
    id: string
    order_id: string
    transaction_id: string
    payment_type: string
    gross_amount: unknown
    status: string
    va_number: string | null
    paid_at: Date | null
    raw_response: unknown
    created_at: Date
};

function toPaymentType(row: PaymentRow): paymentType {
    return {
        id: row.id,
        order_id: row.order_id,
        transaction_id: row.transaction_id,
        payment_type: row.payment_type,
        gross_amount: Number(row.gross_amount),
        status: row.status as paymentType["status"],
        va_number: row.va_number,
        paid_at: row.paid_at ? row.paid_at.toISOString() : null,
        raw_response: row.raw_response as Record<string, unknown> | null,
        created_at: row.created_at.toISOString(),
    };
}

export class pgPaymentRepository implements paymentRepository {
    async create(input: paymentCreateInput): Promise<paymentType> {
        const row = await prisma.payments.create({
            data: {
                order_id: input.order_id,
                transaction_id: input.transaction_id ?? `TRX-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                payment_type: input.payment_type,
                gross_amount: input.gross_amount,
                status: "PENDING",
                va_number: input.va_number ?? null,
                paid_at: null,
                raw_response: null,
            },
        });
        return toPaymentType(row);
    }

    async findByTransactionId(transactionId: string): Promise<paymentType | null> {
        const row = await prisma.payments.findFirst({ where: { transaction_id: transactionId } });
        return row ? toPaymentType(row) : null;
    }

    async findByOrderId(orderId: string): Promise<paymentType | null> {
        const row = await prisma.payments.findFirst({
            where: { order_id: orderId },
            orderBy: { created_at: "desc" },
        });
        return row ? toPaymentType(row) : null;
    }

    async confirm(input: paymentConfirmInput): Promise<paymentType | null> {
        const existing = await this.findByTransactionId(input.transaction_id);
        if (!existing) return null;
        const status = input.status ?? "PAID";
        const paidAt = status === "PAID" ? new Date() : existing.paid_at ? new Date(existing.paid_at) : null;
        const row = await prisma.payments.update({
            where: { id: existing.id },
            data: {
                status,
                paid_at: paidAt,
                raw_response: input.raw_response ?? null,
            },
        });
        return toPaymentType(row);
    }

    async listByUser(userId: string): Promise<paymentType[]> {
        const rows = await prisma.payments.findMany({
            where: { order: { user_id: userId } },
            orderBy: { created_at: "desc" },
        });
        return rows.map(toPaymentType);
    }

    async findActivePendingByUser(userId: string): Promise<paymentType | null> {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rows = await prisma.payments.findMany({
            where: {
                status: "PENDING",
                order: { user_id: userId },
            },
            orderBy: { created_at: "desc" },
            take: 10,
        });
        const row = rows.find((r) => new Date(r.created_at) > cutoff);
        return row ? toPaymentType(row) : null;
    }

    async listPendingOlderThan(hours: number): Promise<paymentType[]> {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const rows = await prisma.payments.findMany({
            where: {
                status: "PENDING",
                created_at: { lt: cutoff },
            },
        });
        return rows.map(toPaymentType);
    }

    async updateStatus(id: string, status: string): Promise<paymentType | null> {
        try {
            const row = await prisma.payments.update({
                where: { id },
                data: { status },
            });
            return toPaymentType(row);
        } catch {
            return null;
        }
    }

    async saveRawResponse(id: string, rawResponse: Record<string, unknown>): Promise<paymentType | null> {
        try {
            const row = await prisma.payments.update({
                where: { id },
                data: { raw_response: rawResponse },
            });
            return toPaymentType(row);
        } catch {
            return null;
        }
    }
}