import { describe, expect, it } from "bun:test";
import { orderEntity } from "./orderEntity";
import { AppError } from "../../helper/errorHandling/appError";
import type { orderStatus } from "../types/orderType";

function validCreate() {
    return {
        services: [{ laundry_service_id: 1, qty: 3 }],
        products: [],
        user_address_id: 1,
        outlet_id: 1,
        distance_km: 2,
        payment_method: "fadarosipay",
    };
}

describe("orderEntity.validateCreate", () => {
    it("accepts a valid order payload", () => {
        const result = orderEntity.validateCreate(validCreate());
        expect(result.services).toHaveLength(1);
        expect(result.payment_method).toBe("fadarosipay");
    });

    it("rejects an empty services list", () => {
        expect(() => orderEntity.validateCreate({ ...validCreate(), services: [] })).toThrow(AppError);
    });

    it("rejects an invalid payment method", () => {
        expect(() => orderEntity.validateCreate({ ...validCreate(), payment_method: "bitcoin" })).toThrow(AppError);
    });

    it("rejects payload missing services AND products", () => {
        expect(() => orderEntity.validateCreate({ ...validCreate(), products: [] })).not.toThrow();
        expect(() => orderEntity.validateCreate({ ...validCreate(), services: [], products: [] })).toThrow(AppError);
    });

    it("coerces numeric string fields", () => {
        const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const result = orderEntity.validateCreate({
            services: [{ laundry_service_id: "1", qty: "2" }],
            user_address_id: "1",
            outlet_id: "1",
            distance_km: "3",
            payment_method: "cod",
        });
        expect(result.services[0]!.qty).toBe(2);
        expect(result.distance_km).toBe(3);
    });
});

describe("orderEntity.validateStatus", () => {
    it("accepts valid statuses", () => {
        for (const s of ["BARU", "DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI", "DIBATALKAN"] as orderStatus[]) {
            expect(orderEntity.validateStatus(s)).toBe(s);
        }
    });

    it("rejects unknown statuses", () => {
        expect(() => orderEntity.validateStatus("PICKED_UP")).toThrow(AppError);
        expect(() => orderEntity.validateStatus(undefined)).toThrow(AppError);
    });
});

describe("orderEntity.assertTransition", () => {
    it("allows forward moves through the flow", () => {
        expect(() => orderEntity.assertTransition("BARU", "DITERIMA")).not.toThrow();
        expect(() => orderEntity.assertTransition("DITERIMA", "DIPROSES")).not.toThrow();
        expect(() => orderEntity.assertTransition("DIPROSES", "SIAP_ANTAR")).not.toThrow();
        expect(() => orderEntity.assertTransition("SIAP_ANTAR", "SELESAI")).not.toThrow();
    });

    it("allows cancelling from BARU or DITERIMA", () => {
        expect(() => orderEntity.assertTransition("BARU", "DIBATALKAN")).not.toThrow();
        expect(() => orderEntity.assertTransition("DITERIMA", "DIBATALKAN")).not.toThrow();
    });

    it("rejects skipping steps", () => {
        expect(() => orderEntity.assertTransition("BARU", "SELESAI")).toThrow(AppError);
        expect(() => orderEntity.assertTransition("DITERIMA", "SIAP_ANTAR")).toThrow(AppError);
    });

    it("rejects transitions from SELESAI or DIBATALKAN", () => {
        expect(() => orderEntity.assertTransition("SELESAI", "DITERIMA")).toThrow(AppError);
        expect(() => orderEntity.assertTransition("DIBATALKAN", "DIPROSES")).toThrow(AppError);
    });

    it("allows idempotent same-status updates", () => {
        expect(() => orderEntity.assertTransition("DIPROSES", "DIPROSES")).not.toThrow();
    });

    it("rejects cancelling an in-flight order", () => {
        expect(() => orderEntity.assertTransition("DIPROSES", "DIBATALKAN")).toThrow(AppError);
        expect(() => orderEntity.assertTransition("SIAP_ANTAR", "DIBATALKAN")).toThrow(AppError);
    });
});

describe("orderEntity IDs", () => {
    it("generates a zero-padded sequential order id", () => {
        const date = new Date(2026, 8, 8);
        expect(orderEntity.generateOrderId(3, date)).toBe("CLN-20260908-003");
        expect(orderEntity.datePrefix(date)).toBe("CLN-20260908-");
    });
});

describe("orderEntity.totals", () => {
    it("applies discounts without turning the total negative", () => {
        const totals = orderEntity.computeTotals({
            laundrySubtotal: "100000.00",
            productSubtotal: "0.00",
            itemCount: 1,
            deliveryFee: "6000.00",
        });
        expect(totals.total_amount).toBe("106000.00");
    });

    it("keeps 2-decimal money amounts", () => {
        const totals = orderEntity.computeTotals({
            laundrySubtotal: "3333.33",
            productSubtotal: "4.56",
            itemCount: 2,
            deliveryFee: "999.5",
        });
        expect(totals.total_laundry).toBe("3333.33");
        expect(totals.total_product).toBe("4.56");
        expect(totals.delivery_fee).toBe("999.50");
    });

    it("zero delivery fee under 1 km", () => {
        expect(orderEntity.computeDeliveryFee(0)).toBe("0.00");
        expect(orderEntity.computeDeliveryFee(3)).toBe("6000.00");
        expect(orderEntity.computeDeliveryFee(1.2)).toBe("2400.00");
    });
});