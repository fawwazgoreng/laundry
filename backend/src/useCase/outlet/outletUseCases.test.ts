import { describe, expect, it, mock } from "bun:test";
import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { outletType } from "../../domain/types/outletType";
import { GetDeliveryQuoteUseCase } from "./outletUseCases";

function makeOutlet(overrides: Partial<outletType> = {}): outletType {
    return {
        id: 1,
        name: "Outlet Test",
        phone: null,
        address_text: "Jl. Test",
        latitude: 0,
        longitude: 0,
        max_coverage_km: 5,
        min_order_amount: "0.00",
        weekly_hours: null,
        ...overrides,
    };
}

function repoWith(outlets: outletType[]): outletRepository {
    return { list: mock(() => outlets) } as unknown as outletRepository;
}

describe("GetDeliveryQuoteUseCase", () => {
    it("quotes the farthest outlet and its delivery fee", async () => {
        const near = makeOutlet({ id: 1, name: "Dekat", longitude: 0.01 });
        const far = makeOutlet({ id: 2, name: "Jauh", longitude: 0.02 });
        const useCase = new GetDeliveryQuoteUseCase(repoWith([near, far]));

        const quote = await useCase.execute({ latitude: 0, longitude: 0 });

        expect(quote.outlet.id).toBe(2);
        expect(quote.distance_km).toBe(2.22);
        expect(quote.delivery_fee).toBe("4440.00");
        expect(quote.in_range).toBe(true);
    });

    it("marks a farthest outlet outside its coverage as out of range", async () => {
        const outlet = makeOutlet({ longitude: 0.02, max_coverage_km: 1 });
        const useCase = new GetDeliveryQuoteUseCase(repoWith([outlet]));

        const quote = await useCase.execute({ latitude: 0, longitude: 0 });

        expect(quote.in_range).toBe(false);
    });

    it("rejects invalid coordinates", async () => {
        const useCase = new GetDeliveryQuoteUseCase(repoWith([makeOutlet()]));

        await expect(useCase.execute({ latitude: "abc", longitude: 0 }))
            .rejects.toMatchObject({ statusCode: 422 });
    });

    it("rejects when no outlet is configured", async () => {
        const useCase = new GetDeliveryQuoteUseCase(repoWith([]));

        await expect(useCase.execute({ latitude: 0, longitude: 0 }))
            .rejects.toMatchObject({ statusCode: 404 });
    });
});
