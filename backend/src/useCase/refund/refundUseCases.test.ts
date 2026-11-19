import { describe, expect, it, mock } from "bun:test";
import { CreateRefundUseCase, DecideRefundUseCase } from "./refundUseCases";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { refundRepository } from "../../domain/repositories/refundRepository";
import type { orderDetailType } from "../../domain/types/orderType";
import type { refundType } from "../../domain/types/refundType";

const productOrder = {
    order_id: "CLN-20261104-001",
    order_type: "PRODUCT",
    status: "SELESAI",
    payment_method: "transfer_bank",
    total_amount: 25000,
    customer: { id: "u-1", username: "Budi", phone: "081" },
    services: [],
    products: [{ id: "item-1" }],
    payment: {
        id: "pay-1",
        transaction_id: "TRX-1",
        status: "PAID",
        gross_amount: 25000,
        payment_type: "transfer_bank",
    },
} as unknown as orderDetailType;

const serviceOrder = {
    ...productOrder,
    order_type: "SERVICE",
    products: [],
    services: [{ id: "svc-item-1" }],
} as unknown as orderDetailType;

const pendingRefund: refundType = {
    id: "refund-1",
    order_id: productOrder.order_id,
    user_id: "u-1",
    payment_id: "pay-1",
    amount: 25000,
    reason: "Barang tidak sesuai pesanan",
    status: "REQUESTED",
    gateway_ref: null,
    requested_at: new Date().toISOString(),
    processed_at: null,
};

function refundRepo(overrides: Partial<refundRepository> = {}): refundRepository {
    return {
        create: mock(async () => pendingRefund),
        findById: mock(async () => pendingRefund),
        findLatestByOrderId: mock(async () => null),
        updateStatus: mock(async () => ({ ...pendingRefund, status: "REFUNDED" })),
        ...overrides,
    } as unknown as refundRepository;
}

describe("CreateRefundUseCase", () => {
    it("rejects refunds for service orders", async () => {
        const orders = {
            findByOrderId: mock(async () => serviceOrder),
        } as unknown as orderRepository;
        const useCase = new CreateRefundUseCase(orders, refundRepo());

        await expect(useCase.execute("u-1", {
            order_id: serviceOrder.order_id,
            reason: "Layanan tidak sesuai harapan",
        })).rejects.toMatchObject({
            statusCode: 409,
            message: "Refund hanya dapat dilakukan untuk order bertipe Product",
        });
    });

    it("creates a refund request for a paid product order", async () => {
        const orders = {
            findByOrderId: mock(async () => productOrder),
        } as unknown as orderRepository;
        const refunds = refundRepo();
        const useCase = new CreateRefundUseCase(orders, refunds);

        const result = await useCase.execute("u-1", {
            order_id: productOrder.order_id,
            reason: "Produk rusak saat diterima",
        });

        expect(result.status).toBe("REQUESTED");
        expect(refunds.create).toHaveBeenCalledWith(expect.objectContaining({
            order_id: productOrder.order_id,
            amount: 25000,
            status: "REQUESTED",
        }));
    });

    it("rejects a second active refund request", async () => {
        const orders = {
            findByOrderId: mock(async () => productOrder),
        } as unknown as orderRepository;
        const refunds = refundRepo({
            findLatestByOrderId: mock(async () => pendingRefund),
        });
        const useCase = new CreateRefundUseCase(orders, refunds);

        await expect(useCase.execute("u-1", {
            order_id: productOrder.order_id,
            reason: "Produk rusak saat diterima",
        })).rejects.toMatchObject({ statusCode: 409 });
    });
});

describe("DecideRefundUseCase", () => {
    it("refunds through the gateway and records an expense", async () => {
        const refunds = refundRepo();
        const orders = { findByOrderId: mock(async () => productOrder) } as unknown as orderRepository;
        const payments = { updateStatus: mock(async () => null) } as unknown as paymentRepository;
        const cashflow = { create: mock(async () => ({})) } as unknown as cashflowRepository;
        const useCase = new DecideRefundUseCase(refunds, orders, payments, cashflow);

        const result = await useCase.execute("refund-1", { status: "APPROVED" }, "admin-1");

        expect(result.status).toBe("REFUNDED");
        expect(payments.updateStatus).toHaveBeenCalledWith("pay-1", "REFUNDED");
        expect(cashflow.create).toHaveBeenCalledWith(expect.objectContaining({
            type: "expense",
            category: "refund",
            amount: 25000,
        }));
    });

    it("rejects a refund decision when the order is service-only", async () => {
        const refunds = refundRepo({ findById: mock(async () => ({ ...pendingRefund, order_id: serviceOrder.order_id })) });
        const orders = { findByOrderId: mock(async () => serviceOrder) } as unknown as orderRepository;
        const useCase = new DecideRefundUseCase(
            refunds,
            orders,
            { updateStatus: mock() } as unknown as paymentRepository,
            { create: mock() } as unknown as cashflowRepository,
        );

        await expect(useCase.execute("refund-1", { status: "APPROVED" }, "admin-1"))
            .rejects.toMatchObject({ statusCode: 409 });
    });
});
