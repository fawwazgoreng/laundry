import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { paymentEntity } from "./paymentEntity";
import { AppError } from "../../helper/errorHandling/appError";

describe("paymentEntity", () => {
    it("validates a create payload", () => {
        const dto = paymentEntity.validateCreate({
            order_id: "CLN-20260908-001",
            payment_type: "transfer_bank",
            gross_amount: "75000",
        });
        expect(dto.gross_amount).toBe("75000.00");
    });

    it("rejects a negative amount", () => {
        expect(() =>
            paymentEntity.validateCreate({
                order_id: "CLN-20260908-001",
                payment_type: "cod",
                gross_amount: -1,
            }),
        ).toThrow(AppError);
    });

    it("validates a confirm payload", () => {
        const dto = paymentEntity.validateConfirm({
            transaction_id: "VA-123",
            status: "PAID",
            raw_response: { gateway: "bank" },
        });
        expect(dto.status).toBe("PAID");
    });

    it("rejects an unknown confirm status", () => {
        expect(() => paymentEntity.validateConfirm({ transaction_id: "VA-123", status: "PENDING" })).toThrow(AppError);
    });

    it("generates a deterministic-length transaction id", () => {
        const id = paymentEntity.generateTransactionId("VA", "CLN-20260908-001");
        expect(id).toMatch(/^VA-/);
    });

    it("recognizes valid statuses only", () => {
        expect(paymentEntity.isValidStatus("PENDING")).toBe(true);
        expect(paymentEntity.isValidStatus("REFUNDED")).toBe(false);
    });

    it("validates a midtrans notification payload", () => {
        const dto = paymentEntity.validateNotification({
            order_id: "CLN-20260908-001",
            status_code: "200",
            gross_amount: "50000.00",
            signature_key: "abc123",
            transaction_status: "settlement",
            payment_type: "bank_transfer",
            va_numbers: [{ bank: "bca", va_number: "12345" }],
        });
        expect(dto.transaction_status).toBe("settlement");
        expect(dto.gross_amount).toBe("50000.00");
    });

    it("verifies a valid midtrans signature", () => {
        const serverKey = "Mid-server-test-key";
        const nib = {
            order_id: "CLN-20260908-001",
            status_code: "200",
            gross_amount: "50000.00",
        };
        const signatureKey = createHash("sha512")
            .update(`${nib.order_id}${nib.status_code}${nib.gross_amount}${serverKey}`)
            .digest("hex");
        expect(
            paymentEntity.isValidSignature({ ...nib, signature_key: signatureKey }, serverKey),
        ).toBe(true);
        expect(
            paymentEntity.isValidSignature({ ...nib, signature_key: "tampered" }, serverKey),
        ).toBe(false);
    });

    it("maps midtrans transaction statuses to payment statuses", () => {
        expect(paymentEntity.mapMidtransStatus("settlement")).toBe("PAID");
        expect(paymentEntity.mapMidtransStatus("capture")).toBe("PAID");
        expect(paymentEntity.mapMidtransStatus("expire")).toBe("EXPIRED");
        expect(paymentEntity.mapMidtransStatus("cancel")).toBe("FAILED");
        expect(paymentEntity.mapMidtransStatus("deny")).toBe("FAILED");
        expect(paymentEntity.mapMidtransStatus("pending")).toBeNull();
        expect(paymentEntity.mapMidtransStatus("unknown_status")).toBeNull();
    });
});