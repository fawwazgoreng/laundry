import { describe, expect, it, mock } from "bun:test";
import { ConfirmPaymentUseCase } from "./paymentUseCases";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";

const pending = {
    id: "pay-1",
    order_id: "CLN-20260908-001",
    transaction_id: "VA-123456789012",
    payment_type: "transfer_bank",
    gross_amount: 50000,
    status: "PENDING" as const,
    paid_at: null,
};

describe("ConfirmPaymentUseCase", () => {
    it("confirms a pending payment and books income", async () => {
        const paymentRepo = {
            findByTransactionId: mock(() => pending),
            confirm: mock(() => ({ ...pending, status: "PAID", paid_at: new Date().toISOString(), raw_response: { confirmedBy: "a-1" } })),
        } as unknown as paymentRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        const result = await new ConfirmPaymentUseCase(paymentRepo, cashflowRepo).execute(
            { transaction_id: pending.transaction_id, status: "PAID", raw_response: { gateway: "bank" } },
            "a-1",
        );

        expect(result.status).toBe("PAID");
        expect(paymentRepo.confirm).toHaveBeenCalled();
        expect(cashflowRepo.create).toHaveBeenCalledTimes(1);
        const cf = (cashflowRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(cf.type).toBe("income");
        expect(Number(cf.amount)).toBe(50000);
    });

    it("rejects confirming an already-paid payment", async () => {
        const paid = { ...pending, status: "PAID" as const, paid_at: new Date().toISOString() };
        const paymentRepo = {
            findByTransactionId: mock(() => paid),
            confirm: mock(() => null),
        } as unknown as paymentRepository;

        await expect(new ConfirmPaymentUseCase(paymentRepo, { create: mock(), summary: mock() } as unknown as cashflowRepository).execute({ transaction_id: paid.transaction_id }, "a-1")).rejects.toMatchObject({ statusCode: 409 });
    });

    it("throws NOT_FOUND for an unknown transaction", async () => {
        const paymentRepo = {
            findByTransactionId: mock(() => null),
            confirm: mock(() => null),
        } as unknown as paymentRepository;

        await expect(new ConfirmPaymentUseCase(paymentRepo, { create: mock(), summary: mock() } as unknown as cashflowRepository).execute({ transaction_id: "NOPE" }, "a-1")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("does not book income when marked FAILED", async () => {
        const paymentRepo = {
            findByTransactionId: mock(() => pending),
            confirm: mock(() => ({ ...pending, status: "FAILED", raw_response: { confirmedBy: "a-1" } })),
        } as unknown as paymentRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        await new ConfirmPaymentUseCase(paymentRepo, cashflowRepo).execute({ transaction_id: pending.transaction_id, status: "FAILED" }, "a-1");
        expect(cashflowRepo.create).not.toHaveBeenCalled();
    });
});