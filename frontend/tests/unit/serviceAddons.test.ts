import { describe, expect, it } from "bun:test";
import { dedupePerOrderAddons, perOrderAddonKey } from "../../src/lib/serviceAddons";
import type { ServiceAddonGroup, ServiceAddonOption } from "../../src/lib/types";

function option(id: number, priceMode: "per_unit" | "per_order"): ServiceAddonOption {
    return {
        id,
        name: `Opsi ${id}`,
        price: "3000.00",
        price_mode: priceMode,
        is_default: false,
        is_active: true,
        sort_order: 1,
    };
}

function group(code: string): ServiceAddonGroup {
    return {
        id: 1,
        code,
        name: code,
        selection_type: "single",
        is_required: false,
        is_active: true,
        sort_order: 1,
        options: [],
    };
}

describe("perOrderAddonKey", () => {
    it("combines group code and option id", () => {
        expect(perOrderAddonKey({ group: { code: "pewangi" }, option: option(21, "per_order") })).toBe(
            "pewangi:21",
        );
    });
});

describe("dedupePerOrderAddons", () => {
    it("keeps a colliding per-order addon only on the first line", () => {
        const addon = { group: group("pewangi"), option: option(21, "per_order") };
        const lines = [
            { id: "service", addons: [addon] },
            { id: "product", addons: [addon] },
        ];

        const result = dedupePerOrderAddons(lines);

        expect(result[0]!.addons).toHaveLength(1);
        expect(result[1]!.addons).toHaveLength(0);
        expect(lines[1]!.addons).toHaveLength(1);
    });

    it("keeps per-unit addons on every line", () => {
        const addon = { group: group("detergen"), option: option(11, "per_unit") };
        const lines = [
            { id: "service", addons: [addon] },
            { id: "product", addons: [addon] },
        ];

        const result = dedupePerOrderAddons(lines);

        expect(result[0]!.addons).toHaveLength(1);
        expect(result[1]!.addons).toHaveLength(1);
    });

    it("dedupes across a shared taken set", () => {
        const addon = { group: group("pewangi"), option: option(21, "per_order") };
        const taken = new Set<string>();

        const services = dedupePerOrderAddons([{ addons: [addon] }], taken);
        const products = dedupePerOrderAddons([{ addons: [addon] }], taken);

        expect(services[0]!.addons).toHaveLength(1);
        expect(products[0]!.addons).toHaveLength(0);
    });
});
