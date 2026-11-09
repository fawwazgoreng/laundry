import { describe, expect, it } from "bun:test";
import type { orderDetailType } from "../../domain/types/orderType";
import {
    REFUND_WINDOW_DAYS,
    assertRefundEligibility,
    evaluateRefundEligibility,
    type refundEligibilityInput,
} from "./refundValidator";
import { AppError } from "../../helper/errorHandling/appError";

function productOrder(overrides: Partial<orderDetailType> = {}): orderDetailType {
    return {
        id: "ord-1",
        order_id: "CLN-20261104-001",
        status: "SELESAI",
        order_type: "PRODUCT",
        refund_eligible: true,
        payment_method: "transfer_bank",
        total_laundry: "0.00",
        total_product: "25000.00",
        total_addon: "0.00",
        delivery_fee: "0.00",
        total_amount: "25000.00",
        distance_km: 1,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        customer: { id: "u-1", username: "Budi", phone: "081" },
        address: null,
        outlet: null,
        services: [],
        products: [{ id: "item-1" }],
        payment: {
            id: "pay-1",
            transaction_id: "TRX-1",
            payment_type: "transfer_bank",
            gross_amount: "25000.00",
            status: "PAID",
            va_number: null,
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            raw_response: null,
        },
        refund: null,
        trackings: [],
    } as unknown as orderDetailType;
}

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type Row = {
    title: string
    input: (base: { order: orderDetailType }) => refundEligibilityInput
    codes: string[]
};

const rows: Row[] = [
    {
        title: "order product valid tetap memenuhi syarat",
        input: ({ order }) => ({ order, now: new Date() }),
        codes: [],
    },
    {
        title: "order service menghasilkan ITEM_NOT_PRODUCT",
        input: ({ order }) => ({
            order: { ...order, order_type: "SERVICE" },
            now: new Date(),
        }),
        codes: ["ITEM_NOT_PRODUCT"],
    },
    {
        title: "order DIBATALKAN menghasilkan ORDER_STATUS_INVALID",
        input: ({ order }) => ({ order: { ...order, status: "DIBATALKAN" }, now: new Date() }),
        codes: ["ORDER_STATUS_INVALID"],
    },
    {
        title: "pembayaran belum lunas menghasilkan PAYMENT_NOT_PAID",
        input: ({ order }) => ({
            order: { ...order, payment: { ...order.payment!, status: "PENDING" } },
            now: new Date(),
        }),
        codes: ["PAYMENT_NOT_PAID"],
    },
    {
        title: "pembayaran tanpa record menghasilkan PAYMENT_NOT_PAID",
        input: ({ order }) => ({ order: { ...order, payment: null }, now: new Date() }),
        codes: ["PAYMENT_NOT_PAID"],
    },
    {
        title: "COD menghasilkan PAYMENT_NOT_GATEWAY",
        input: ({ order }) => ({ order: { ...order, payment_method: "cod" }, now: new Date() }),
        codes: ["PAYMENT_NOT_GATEWAY"],
    },
    {
        title: "refund melewati jendela waktu menghasilkan REFUND_WINDOW_EXPIRED",
        input: ({ order }) => ({
            order: { ...order, payment: { ...order.payment!, paid_at: daysAgo(REFUND_WINDOW_DAYS + 2).toISOString() } },
            now: new Date(),
        }),
        codes: ["REFUND_WINDOW_EXPIRED"],
    },
    {
        title: "refund sebelum batas jendela waktu tetap mutakhir",
        input: ({ order }) => ({
            order: { ...order, payment: { ...order.payment!, paid_at: daysAgo(REFUND_WINDOW_DAYS - 1).toISOString() } },
            now: new Date(),
        }),
        codes: [],
    },
    {
        title: "payment REFUNDED menghasilkan ALREADY_REFUNDED",
        input: ({ order }) => ({
            order: { ...order, payment: { ...order.payment!, status: "REFUNDED" } },
            now: new Date(),
        }),
        codes: ["ALREADY_REFUNDED"],
    },
    {
        title: "pengajuan refund tua REFUNDED menghasilkan ALREADY_REFUNDED",
        input: ({ order }) => ({
            order,
            now: new Date(),
            latestRefundStatus: "REFUNDED",
        }),
        codes: ["ALREADY_REFUNDED"],
    },
];

describe("evaluateRefundEligibility (tabel)", () => {
    for (const row of rows) {
        it(row.title, () => {
            const violations = evaluateRefundEligibility(row.input({ order: productOrder() }));
            expect(violations.map((v) => v.code)).toEqual(row.codes);
        });
    }

    it("melempar konflik dengan detail kode pelanggaran", () => {
        const order = { ...productOrder(), order_type: "SERVICE" } as orderDetailType;
        try {
            assertRefundEligibility({ order, now: new Date() });
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            const err = error as AppError;
            expect(err.statusCode).toBe(409);
        }
    });

    it("melempar konflik berisi kode pelanggaran pada details", () => {
        const order = { ...productOrder(), order_type: "SERVICE" } as orderDetailType;
        let captured: AppError | null = null;
        try {
            assertRefundEligibility({ order, now: new Date() });
        } catch (error) {
            captured = error as AppError;
        }
        expect(captured).not.toBeNull();
        expect(captured!.statusCode).toBe(409);
        expect((captured!.details as { violations: string[] }).violations).toEqual(["ITEM_NOT_PRODUCT"]);
    });
});
});
