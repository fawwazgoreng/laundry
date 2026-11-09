import type { orderDetailType } from "../../domain/types/orderType";
import type { refundStatus } from "../../domain/types/refundType";
import { AppError } from "../../helper/errorHandling/appError";

/** Jendela waktu pengajuan refund: X hari sejak pembayaran terverifikasi. */
export const REFUND_WINDOW_DAYS = 7;

export type refundViolationCode =
    | "ITEM_NOT_PRODUCT"
    | "ORDER_STATUS_INVALID"
    | "PAYMENT_NOT_GATEWAY"
    | "PAYMENT_NOT_PAID"
    | "REFUND_WINDOW_EXPIRED"
    | "ALREADY_REFUNDED";

export type refundViolation = { code: refundViolationCode; message: string };

export interface refundEligibilityInput {
    order: orderDetailType
    now: Date
    /** Status pengajuan refund terakhir untuk order ini (bila ada). */
    latestRefundStatus?: refundStatus | null
}

const MESSAGES: Record<refundViolationCode, string> = {
    ITEM_NOT_PRODUCT: "Refund hanya dapat dilakukan untuk order bertipe Product",
    ORDER_STATUS_INVALID: "Pesanan yang dibatalkan tidak dapat diajukan refund",
    PAYMENT_NOT_GATEWAY: "Refund online hanya tersedia untuk pembayaran melalui gateway",
    PAYMENT_NOT_PAID: "Refund hanya dapat diajukan untuk pembayaran yang sudah lunas",
    REFUND_WINDOW_EXPIRED: `Batas waktu pengajuan refund ${REFUND_WINDOW_DAYS} hari sejak pembayaran telah terlewat`,
    ALREADY_REFUNDED: "Refund untuk pesanan ini sudah pernah diproses",
};

export function refundViolationMessage(code: refundViolationCode): string {
    return MESSAGES[code];
}

function isRefunded(input: refundEligibilityInput): boolean {
    if (input.latestRefundStatus === "REFUNDED") return true;
    return input.order.payment?.status === "REFUNDED";
}

/**
 * Validator kemampuan refund yang murni: semua aturan berakhir di daftar pelanggaran,
 * tanpa efek samping. Amankan untuk keputusan maupun pengajuan.
 */
export function evaluateRefundEligibility(input: refundEligibilityInput): refundViolation[] {
    const { order, now } = input;
    const violations: refundViolation[] = [];

    if (order.order_type !== "PRODUCT") {
        violations.push({ code: "ITEM_NOT_PRODUCT", message: MESSAGES.ITEM_NOT_PRODUCT });
    } else if (order.status === "DIBATALKAN") {
        violations.push({ code: "ORDER_STATUS_INVALID", message: MESSAGES.ORDER_STATUS_INVALID });
    } else if (isRefunded(input)) {
        violations.push({ code: "ALREADY_REFUNDED", message: MESSAGES.ALREADY_REFUNDED });
    } else if (!order.payment || order.payment.status !== "PAID") {
        violations.push({ code: "PAYMENT_NOT_PAID", message: MESSAGES.PAYMENT_NOT_PAID });
    } else if (order.payment_method === "cod") {
        violations.push({ code: "PAYMENT_NOT_GATEWAY", message: MESSAGES.PAYMENT_NOT_GATEWAY });
    }

    const paidAt = order.payment?.paid_at;
    if (paidAt && !isRefunded(input)) {
        const anchor = new Date(paidAt);
        const deadline = anchor.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        if (!Number.isNaN(anchor.getTime()) && now.getTime() > deadline) {
            violations.push({ code: "REFUND_WINDOW_EXPIRED", message: MESSAGES.REFUND_WINDOW_EXPIRED });
        }
    }

    return violations;
}

/** Lempar konflik 409 dengan seluruh kode pelanggaran bila tidak memenuhi syarat. */
export function assertRefundEligibility(input: refundEligibilityInput): void {
    const violations = evaluateRefundEligibility(input);
    if (violations.length === 0) return;
    throw AppError.conflict(
        violations.map((violation) => violation.message).join("; "),
        { violations: violations.map((violation) => violation.code) },
    );
}
