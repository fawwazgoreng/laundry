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
        expect(dto.gross_amount).toBe(75000);
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
});