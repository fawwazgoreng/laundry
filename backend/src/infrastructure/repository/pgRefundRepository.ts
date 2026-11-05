import type { refundRepository } from "../../domain/repositories/refundRepository";
import type { refundCreateType, refundStatus, refundType, refundUpdateType } from "../../domain/types/refundType";
import { prisma } from "../prisma/prisma";
import { fromInstant, instant, numeric, varchar } from "../prisma/scalars";

type RefundRow = {
    id: string
    order_id: string
    user_id: string
    payment_id: string | null
    amount: unknown
    reason: string
    status: string
    gateway_ref: string | null
    gateway_response: unknown
    requested_at: Temporal.Instant
    processed_at: Temporal.Instant | null
};

function toRefundType(row: RefundRow): refundType {
    return {
        id: row.id,
        order_id: row.order_id,
        user_id: row.user_id,
        payment_id: row.payment_id,
        amount: Number(row.amount),
        reason: row.reason,
        status: row.status as refundStatus,
        gateway_ref: row.gateway_ref,
        requested_at: fromInstant(row.requested_at).toISOString(),
        processed_at: row.processed_at ? fromInstant(row.processed_at).toISOString() : null,
    };
}

export class pgRefundRepository implements refundRepository {
    async create(input: refundCreateType): Promise<refundType> {
        const row = await prisma.orm.public.Refund_requests.create({
            order_id: input.order_id,
            user_id: input.user_id,
            payment_id: input.payment_id ?? null,
            amount: numeric<12, 2>(input.amount),
            reason: input.reason,
            status: varchar<20>(input.status ?? "REQUESTED"),
            requested_at: instant(new Date()),
        });
        return toRefundType(row);
    }

    async findById(id: string): Promise<refundType | null> {
        const row = await prisma.orm.public.Refund_requests.where({ id }).first();
        return row ? toRefundType(row) : null;
    }

    async findLatestByOrderId(orderId: string): Promise<refundType | null> {
        const row = await prisma.orm.public.Refund_requests
            .where({ order_id: orderId })
            .orderBy((refund) => refund.requested_at.desc())
            .first();
        return row ? toRefundType(row) : null;
    }

    async updateStatus(id: string, input: refundUpdateType): Promise<refundType | null> {
        const existing = await prisma.orm.public.Refund_requests.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.public.Refund_requests.where({ id }).update({
            status: varchar<20>(input.status),
            ...(input.gateway_ref !== undefined ? { gateway_ref: input.gateway_ref } : {}),
            ...(input.gateway_response !== undefined ? { gateway_response: input.gateway_response as any } : {}),
            ...(input.processed_by !== undefined ? { processed_by: input.processed_by } : {}),
            ...(input.processed_at !== undefined
                ? { processed_at: input.processed_at ? instant(new Date(input.processed_at)) : null }
                : {}),
        });
        return row ? toRefundType(row) : null;
    }
}
