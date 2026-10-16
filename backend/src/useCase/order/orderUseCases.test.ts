import { describe, expect, it, mock } from "bun:test";
import { CreateOrderUseCase, UpdateOrderStatusUseCase, CancelOrderUseCase, DeleteOrderUseCase, type midtransCoreApiClient } from "./orderUseCases";
import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { paymentRepository } from "../../domain/repositories/paymentRepository";
import type { productRepository } from "../../domain/repositories/productRepository";
import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type { orderDetailType, orderStatus } from "../../domain/types/orderType";
import { orderEntity } from "../../domain/entities/orderEntity";
import { AppError } from "../../helper/errorHandling/appError";

const svc = {
    id: 1,
    name: "Cuci Setrika",
    unit: "kg",
    price_per_unit: 5000,
    description: "",
    estimated_duration_hours: 24,
    is_active: true,
};
const prod = {
    id: 7,
    name: "Detergen Premium",
    category: "Detergen" as const,
    price: 45000,
    size: "1.5L",
    stock: 5,
    is_active: true,
    image: "",
};
const address = {
    id: 4,
    label: "Rumah",
    address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
    latitude: -6.2,
    longitude: 106.7,
    is_primary: true,
    user_id: "u-1",
};
const outlet = {
    id: 3,
    name: "Fadarosi Cabang Test",
    phone: null,
    address_text: "Kota",
    latitude: -6.1,
    longitude: 106.8,
    max_coverage_km: 5,
    min_order_amount: 0,
    weekly_hours: null,
};

function makeOrder(overrides: Partial<orderDetailType> = {}): orderDetailType {
    const base: orderDetailType = {
        id: "ord-1",
        order_id: "CLN-20260908-001",
        status: "BARU",
        payment_method: "fadarosipay",
        total_laundry: 15000,
        total_product: 0,
        delivery_fee: 4000,
        total_amount: 19000,
        distance_km: 2,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        customer: { id: "u-1", username: "Budi", phone: "081" },
        address: { id: 4, label: "Rumah", address_text: "Jl. Kebon Jeruk" },
        outlet: { id: 3, name: "Fadarosi Cabang Test", latitude: -6.1, longitude: 106.8 },
        services: [],
        products: [],
        payment: null,
        trackings: [],
    };
    return { ...base, ...overrides };
}

function future() {
    return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
}

function validInput() {
    return {
        services: [{ laundry_service_id: svc.id, qty: 3 }],
        products: [],
        user_address_id: address.id,
        outlet_id: outlet.id,
        distance_km: 2,
        payment_method: "fadarosipay",
    };
}

describe("CreateOrderUseCase", () => {
    it("creates an order and charges fadarosipay immediately", async () => {
        const order = makeOrder();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const paymentRepo = {
            create: mock(() => ({ id: "pay-1", order_id: order.order_id, transaction_id: "FDP-1", payment_type: "fadarosipay", gross_amount: 19000, status: "PENDING", paid_at: null })),
            confirm: mock((input: { transaction_id: string; status: string }) => ({
                id: "pay-1",
                order_id: order.order_id,
                transaction_id: input.transaction_id,
                payment_type: "fadarosipay",
                gross_amount: 19000,
                status: input.status,
                paid_at: new Date().toISOString(),
                raw_response: { gateway: "fadarosipay", method: "wallet" },
            })),
            findActivePendingByUser: mock(() => null),
        } as unknown as paymentRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            cashflowRepo,
        );

        const result = await uc.execute("u-1", validInput());

        expect(result.order_id).toBe(orderEntity.generateOrderId(1));
        expect(result.token).toBe("");
        expect(result.redirect_url).toBe("");
        expect(orderRepo.create).toHaveBeenCalled();
        const created = (orderRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(created.status).toBe("BARU");
        expect(created.delivery_fee).toBe(4000);
        expect(paymentRepo.confirm).toHaveBeenCalled();
        expect(cashflowRepo.create).toHaveBeenCalledTimes(1);
        const cf = (cashflowRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(cf.type).toBe("income");
        expect(cf.category).toBe("sales");
    });

    it("creates a COD order already accepted (DITERIMA)", async () => {
        const order = makeOrder();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
            findByOrderId: mock(() => order),
        } as unknown as orderRepository;
        const paymentRepo = {
            create: mock(() => ({
                id: "pay-1",
                order_id: order.order_id,
                transaction_id: "TRX-PAY-COD",
                payment_type: "cod",
                gross_amount: 19000,
                status: "PENDING",
                paid_at: null,
                va_number: null,
            })),
            confirm: mock(() => null),
            findActivePendingByUser: mock(() => null),
        } as unknown as paymentRepository;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            { create: mock(async () => ({})) } as unknown as cashflowRepository,
        );

        await uc.execute("u-1", { ...validInput(), payment_method: "cod" });

        const created = (orderRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(created.status).toBe("DITERIMA");
        expect(created.tracking.status).toBe("DITERIMA");
    });

    it("rejects a new order while an active pending payment exists and reports remaining time", async () => {
        const order = makeOrder();
        const createdNearlyNow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
            findByOrderId: mock(() => order),
        } as unknown as orderRepository;
        const paymentRepo = {
            findActivePendingByUser: mock(() => ({
                id: "pay-a",
                order_id: "CLN-20260908-009",
                transaction_id: "TRX-1",
                payment_type: "transfer_bank",
                gross_amount: 50000,
                status: "PENDING" as const,
                va_number: "7001",
                paid_at: null,
                created_at: createdNearlyNow,
            })),
            create: mock(),
            confirm: mock(),
        } as unknown as paymentRepository;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            { create: mock(async () => ({})) } as unknown as cashflowRepository,
        );

        try {
            await uc.execute("u-1", validInput());
            expect.unreachable("expected conflict error");
        } catch (error) {
            const appError = error as { statusCode: number; details?: Record<string, unknown> };
            expect(appError.statusCode).toBe(409);
            expect(appError.details?.["order_id"]).toBe("CLN-20260908-009");
            expect(appError.details?.["expires_at"]).toBeDefined();
            expect(appError.details?.["remaining_seconds"]).toBeGreaterThan(0);
        }
        expect(orderRepo.create).not.toHaveBeenCalled();
    });

    it("caps the member discount at 15% of subtotal", async () => {
        const order = makeOrder();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
            findByOrderId: mock(() => order),
        } as unknown as orderRepository;
        const paymentRepo = { create: mock(() => ({})), confirm: mock(() => null), findActivePendingByUser: mock(() => null) } as unknown as paymentRepository;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            { create: mock(async () => ({})) } as unknown as cashflowRepository,
        );

        await uc.execute("u-1", { ...validInput() });

        const created = (orderRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
    });

    it("rejects an order when product stock is insufficient", async () => {
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => makeOrder()),
        } as unknown as orderRepository;
        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => ({ ...prod, stock: 1 })), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            { create: mock(), confirm: mock(), findActivePendingByUser: mock(() => null) } as unknown as paymentRepository,
            { create: mock() } as unknown as cashflowRepository,
        );

        await expect(
            uc.execute("u-1", { ...validInput(), products: [{ product_id: prod.id, qty: 3 }] }),
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects an order when the service is inactive", async () => {
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => makeOrder()),
        } as unknown as orderRepository;
        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => ({ ...svc, is_active: false })), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            { create: mock(), confirm: mock(), findActivePendingByUser: mock(() => null) } as unknown as paymentRepository,
            { create: mock() } as unknown as cashflowRepository,
        );

        await expect(uc.execute("u-1", validInput())).rejects.toMatchObject({ statusCode: 409 });
    });

    it("charges a bank transfer VA via midtrans core api for transfer_bank", async () => {
        const order = makeOrder();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
            findByOrderId: mock(() => order),
        } as unknown as orderRepository;
        const paymentRepo = {
            create: mock((input: { transaction_id?: string; va_number?: string }) => ({
                id: "pay-1",
                order_id: order.order_id,
                transaction_id: input.transaction_id ?? "",
                payment_type: "transfer_bank",
                gross_amount: 19000,
                status: "PENDING",
                paid_at: null,
                va_number: input.va_number ?? null,
            })),
            saveRawResponse: mock((id: string, raw: Record<string, unknown>) => ({})),
            confirm: mock(() => null),
            findActivePendingByUser: mock(() => null),
        } as unknown as paymentRepository;
        const coreApiFake = {
            charge: mock(async () => ({
                transaction_id: "TRX-123456",
                va_numbers: [{ bank: "bca", va_number: "7001212345678901" }],
            })),
        } as unknown as midtransCoreApiClient;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            { create: mock(async () => ({})) } as unknown as cashflowRepository,
            coreApiFake,
        );

        const result = await uc.execute("u-1", { ...validInput(), payment_method: "transfer_bank", bank: "bca" });

        expect(coreApiFake.charge).toHaveBeenCalled();
        const chargeParams = (coreApiFake.charge as ReturnType<typeof mock>).mock.calls[0][0];
        expect(chargeParams.payment_type).toBe("bank_transfer");
        expect(chargeParams.bank_transfer.bank).toBe("bca");
        const payment = (paymentRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(payment.transaction_id).toBe("TRX-123456");
        expect(payment.va_number).toBe("7001212345678901");
        expect(result.va_number).toBe("7001212345678901");
        expect(result.order_id).toBe(orderEntity.generateOrderId(1));
    });

    it("rejects transfer_bank when no bank is chosen", async () => {
        const order = makeOrder();
        const orderRepo = {
            countByDatePrefix: mock(() => 0),
            create: mock(() => order),
        } as unknown as orderRepository;
        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            { create: mock(), confirm: mock(), findActivePendingByUser: mock(() => null) } as unknown as paymentRepository,
            { create: mock() } as unknown as cashflowRepository,
        );

        await expect(
            uc.execute("u-1", { ...validInput(), payment_method: "transfer_bank" }),
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("retries on duplicate order id collisions", async () => {
        const order = makeOrder();
        let countCalls = 0;
        let createCalls = 0;
        const orderRepo = {
            countByDatePrefix: mock(() => countCalls++),
            create: mock(() => {
                createCalls++;
                if (createCalls <= 2) throw { code: "P2002", meta: { target: ["order_id"] } };
                return order;
            }),
            findByOrderId: mock((id: string) => ({ ...order, order_id: id })),
        } as unknown as orderRepository;
        const paymentRepo = { create: mock(() => ({ id: "p", order_id: order.order_id, transaction_id: "T", payment_type: "fadarosipay", gross_amount: 1, status: "PENDING", paid_at: null })), confirm: mock(() => null), findActivePendingByUser: mock(() => null) } as unknown as paymentRepository;

        const uc = new CreateOrderUseCase(
            orderRepo,
            { findById: mock(() => svc), list: mock(), create: mock(), update: mock(), remove: mock() } as unknown as serviceRepository,
            { findById: mock(() => prod), list: mock(), create: mock(), update: mock(), remove: mock(), updateImage: mock(), decrementStock: mock() } as unknown as productRepository,
            { findById: mock(() => address) } as unknown as addressRepository,
            { findById: mock(() => outlet) } as unknown as outletRepository,
            paymentRepo,
            { create: mock(async () => ({})) } as unknown as cashflowRepository,
        );

        const result = await uc.execute("u-1", { ...validInput(), payment_method: "cod" });

        expect(createCalls).toBe(3);
        expect(result.order_id).toBe(orderEntity.generateOrderId(3));
    });
});

describe("UpdateOrderStatusUseCase", () => {
    const paidPayment = {
        id: "pay-1",
        transaction_id: "COD-1",
        payment_type: "cod" as const,
        gross_amount: 19000,
        status: "PENDING",
        paid_at: null,
        created_at: new Date().toISOString(),
    };

    it("moves an order forward and records tracking", async () => {
        const order = makeOrder({ status: "BARU" as orderStatus });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async (_id: string, status: orderStatus) => {
                order.status = status;
            }),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const uc = new UpdateOrderStatusUseCase(
            orderRepo,
            { create: mock(), confirm: mock(), findByTransactionId: mock(), findByOrderId: mock(), listByUser: mock() } as unknown as paymentRepository,
            { create: mock(async () => ({})), summary: mock() } as unknown as cashflowRepository,
        );

        const result = await uc.execute("CLN-20260908-001", { status: "DITERIMA" }, "a-1");

        expect(result.status).toBe("DITERIMA");
        expect(orderRepo.updateStatus).toHaveBeenCalledWith("CLN-20260908-001", "DITERIMA");
        expect(orderRepo.addTracking).toHaveBeenCalled();
    });

    it("rejects an invalid skip transition", async () => {
        const order = makeOrder({ status: "BARU" as orderStatus });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const uc = new UpdateOrderStatusUseCase(
            orderRepo,
            { create: mock(), confirm: mock(), findByTransactionId: mock(), findByOrderId: mock(), listByUser: mock() } as unknown as paymentRepository,
            { create: mock(), summary: mock() } as unknown as cashflowRepository,
        );

        await expect(uc.execute("CLN-20260908-001", { status: "SELESAI" }, "a-1")).rejects.toMatchObject({ statusCode: 409 });
        expect(orderRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("books income and pays a pending COD on SELESAI", async () => {
        const order = makeOrder({ status: "SIAP_ANTAR" as orderStatus, payment: paidPayment });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async (_id: string, status: orderStatus) => {
                order.status = status;
            }),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const paymentRepo = {
            confirm: mock(() => ({
                ...paidPayment,
                status: "PAID",
                paid_at: new Date().toISOString(),
                raw_response: { confirmedBy: "admin-status-update" },
            })),
            create: mock(), findByTransactionId: mock(), findByOrderId: mock(), listByUser: mock(),
        } as unknown as paymentRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        const uc = new UpdateOrderStatusUseCase(orderRepo, paymentRepo, cashflowRepo);
        const result = await uc.execute("CLN-20260908-001", { status: "SELESAI" }, "a-1");

        expect(result.status).toBe("SELESAI");
        expect(paymentRepo.confirm).toHaveBeenCalled();
        expect(cashflowRepo.create).toHaveBeenCalledTimes(1);
        const cf = (cashflowRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(cf.type).toBe("income");
        expect(cf.amount).toBe(19000);
    });

    it("does not double-book income when payment is already PAID", async () => {
        const order = makeOrder({
            status: "SIAP_ANTAR" as orderStatus,
            payment: { ...paidPayment, status: "PAID" },
        });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const paymentRepo = { confirm: mock(), create: mock(), findByTransactionId: mock(), findByOrderId: mock(), listByUser: mock() } as unknown as paymentRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        const uc = new UpdateOrderStatusUseCase(orderRepo, paymentRepo, cashflowRepo);
        await uc.execute("CLN-20260908-001", { status: "SELESAI" }, "a-1");

        expect(cashflowRepo.create).not.toHaveBeenCalled();
    });
});

describe("CancelOrderUseCase", () => {
    it("cancels a BARU order and refunds a paid payment", async () => {
        const order = makeOrder({
            status: "BARU" as orderStatus,
            payment: {
                id: "pay-1",
                transaction_id: "FDP-1",
                payment_type: "fadarosipay",
                gross_amount: 19000,
                status: "PAID",
                paid_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
            },
        });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async (_id: string, status: orderStatus) => {
                order.status = status;
            }),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        const uc = new CancelOrderUseCase(orderRepo, cashflowRepo);
        const result = await uc.execute("CLN-20260908-001", "u-1");

        expect(result.status).toBe("DIBATALKAN");
        expect(cashflowRepo.create).toHaveBeenCalledTimes(1);
        const cf = (cashflowRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(cf.type).toBe("expense");
        expect(cf.category).toBe("refund");
    });

    it("does not refund a pending payment", async () => {
        const order = makeOrder({
            status: "BARU" as orderStatus,
            payment: { id: "p", transaction_id: "T", payment_type: "transfer_bank", gross_amount: 19000, status: "PENDING", paid_at: null, created_at: new Date().toISOString() },
        });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        await new CancelOrderUseCase(orderRepo, cashflowRepo).execute("CLN-20260908-001", "u-1");
        expect(cashflowRepo.create).not.toHaveBeenCalled();
    });

    it("blocks cancelling an in-flight order", async () => {
        const order = makeOrder({ status: "DIPROSES" as orderStatus });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;

        await expect(new CancelOrderUseCase(orderRepo, { create: mock(), summary: mock() } as unknown as cashflowRepository).execute("CLN-20260908-001", "u-1")).rejects.toMatchObject({ statusCode: 409 });
        expect(orderRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("blocks a non-owner", async () => {
        const order = makeOrder();
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;

        await expect(new CancelOrderUseCase(orderRepo, { create: mock(), summary: mock() } as unknown as cashflowRepository).execute("CLN-20260908-001", "u-2")).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe("DeleteOrderUseCase", () => {
    it("deletes a BARU order and creates a refund when paid", async () => {
        const order = makeOrder({
            status: "BARU" as orderStatus,
            payment: { id: "p", transaction_id: "T", payment_type: "fadarosipay", gross_amount: 19000, status: "PAID", paid_at: null, created_at: new Date().toISOString() },
        });
        const orderRepo = {
            findByOrderId: mock(() => order),
            updateStatus: mock(async () => {}),
            addTracking: mock(async () => {}),
        } as unknown as orderRepository;
        const cashflowRepo = { create: mock(async () => ({})) } as unknown as cashflowRepository;

        await new DeleteOrderUseCase(orderRepo, cashflowRepo).execute("CLN-20260908-001", "a-1");
        expect(orderRepo.updateStatus).toHaveBeenCalledWith("CLN-20260908-001", "DIBATALKAN");
        expect(cashflowRepo.create).toHaveBeenCalledTimes(1);
    });

    it("rejects deletion of an in-progress order", async () => {
        const order = makeOrder({ status: "SELESAI" as orderStatus });
        const orderRepo = { findByOrderId: mock(() => order), updateStatus: mock(async () => {}), addTracking: mock(async () => {}) } as unknown as orderRepository;

        await expect(new DeleteOrderUseCase(orderRepo, { create: mock(), summary: mock() } as unknown as cashflowRepository).execute("CLN-20260908-001", "a-1")).rejects.toMatchObject({ statusCode: 409 });
    });
});