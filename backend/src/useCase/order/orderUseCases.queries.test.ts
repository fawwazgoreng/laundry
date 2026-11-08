import { describe, expect, it, mock } from "bun:test";
import { GetOrderUseCase, ListOrdersUseCase } from "./index";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type { orderDetailType, orderListItemType } from "../../domain/types/orderType";

function makeListItem(overrides: Partial<orderListItemType> = {}): orderListItemType {
    return {
        id: "ord-1",
        order_id: "CLN-20260908-001",
        status: "BARU",
        order_type: "SERVICE",
        refund_eligible: false,
        refund_status: null,
        total_amount: "19000.00",
        payment_method: "fadarosipay",
        payment_status: "PENDING",
        created_at: new Date().toISOString(),
        customer_id: "u-1",
        customer_name: "Budi",
        customer_phone: "081",
        items_summary: "Cuci Setrika 3 kg",
        items_unit: "3 kg",
        ...overrides,
    };
}

describe("ListOrdersUseCase (characterization)", () => {
    it("routes a customer to listByUser with default paging", async () => {
        const orders = {
            listByUser: mock(async () => ({ data: [makeListItem()], count: 1 })),
            listAll: mock(async () => ({ data: [], count: 0 })),
        } as unknown as orderRepository;

        const result = await new ListOrdersUseCase(orders).execute("u-1", "user");

        expect(orders.listByUser).toHaveBeenCalledWith("u-1", { page: 1, perPage: 10 });
        expect(orders.listAll).not.toHaveBeenCalled();
        expect(result.meta).toEqual({ firstPage: 1, currentPage: 1, lastPage: 1, count: 1 });
        expect(result.data).toHaveLength(1);
    });

    it("routes an admin to listAll and computes lastPage", async () => {
        const orders = {
            listByUser: mock(async () => ({ data: [], count: 0 })),
            listAll: mock(async () => ({ data: [makeListItem(), makeListItem()], count: 11 })),
        } as unknown as orderRepository;

        const result = await new ListOrdersUseCase(orders).execute("u-1", "admin", { page: 2, perPage: 10, status: "SELESAI" });

        expect(orders.listAll).toHaveBeenCalledWith({ page: 2, perPage: 10, status: "SELESAI" });
        expect(orders.listByUser).not.toHaveBeenCalled();
        expect(result.meta.lastPage).toBe(2);
        expect(result.meta.currentPage).toBe(2);
    });

    it("keeps lastPage at 1 even with zero results", async () => {
        const orders = {
            listByUser: mock(async () => ({ data: [], count: 0 })),
            listAll: mock(async () => ({ data: [], count: 0 })),
        } as unknown as orderRepository;

        const result = await new ListOrdersUseCase(orders).execute("u-1", "user", { page: 3, perPage: 5 });

        expect(result.meta.lastPage).toBe(1);
        expect(result.meta.currentPage).toBe(3);
    });
});

describe("GetOrderUseCase (characterization)", () => {
    const order = { order_id: "CLN-20260908-001", customer: { id: "u-1" } } as unknown as orderDetailType;

    it("returns an order for its owner", async () => {
        const orders = { findByOrderId: mock(async () => order) } as unknown as orderRepository;
        const result = await new GetOrderUseCase(orders).execute("CLN-20260908-001", "u-1", "user");
        expect(result.order_id).toBe("CLN-20260908-001");
    });

    it("returns any order for an admin", async () => {
        const orders = { findByOrderId: mock(async () => order) } as unknown as orderRepository;
        const result = await new GetOrderUseCase(orders).execute("CLN-20260908-001", "a-1", "admin");
        expect(result.order_id).toBe("CLN-20260908-001");
    });

    it("rejects another customer with 403", async () => {
        const orders = { findByOrderId: mock(async () => order) } as unknown as orderRepository;
        await expect(new GetOrderUseCase(orders).execute("CLN-20260908-001", "u-2", "user"))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects a missing order with 404", async () => {
        const orders = { findByOrderId: mock(async () => null) } as unknown as orderRepository;
        await expect(new GetOrderUseCase(orders).execute("CLN-00000000-001", "u-1", "user"))
            .rejects.toMatchObject({ statusCode: 404 });
    });
});
