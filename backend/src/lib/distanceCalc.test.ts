import { describe, expect, it } from "bun:test";
import {
    assertWithinCoverage,
    calculateDistance,
    roundDistanceKm,
    selectFarthestOutlet,
} from "./distanceCalc";

const jakarta = { latitude: -6.2, longitude: 106.8 };

describe("calculateDistance", () => {
    it("returns 0 for the same coordinate", () => {
        expect(calculateDistance(jakarta, jakarta)).toBe(0);
    });

    it("is close to 111.2 km for one degree of latitude", () => {
        const distance = calculateDistance(
            { latitude: 0, longitude: 0 },
            { latitude: 1, longitude: 0 },
        );
        expect(distance).toBeGreaterThan(111);
        expect(distance).toBeLessThan(111.3);
    });
});

describe("roundDistanceKm", () => {
    it("rounds to two decimals to match NUMERIC(6,2)", () => {
        expect(roundDistanceKm(1.23456)).toBe(1.23);
        expect(roundDistanceKm(1.23556)).toBe(1.24);
    });
});

describe("selectFarthestOutlet", () => {
    it("returns the outlet with the greatest distance", () => {
        const near = { id: "near", latitude: -6.2005, longitude: 106.8005 };
        const far = { id: "far", latitude: -6.3, longitude: 106.9 };
        const middle = { id: "middle", latitude: -6.25, longitude: 106.85 };

        const result = selectFarthestOutlet(jakarta, [near, far, middle]);

        expect(result?.outlet.id).toBe("far");
        expect(result?.distanceKm).toBeGreaterThan(10);
    });

    it("returns null when there is no outlet", () => {
        expect(selectFarthestOutlet(jakarta, [])).toBeNull();
    });
});

describe("assertWithinCoverage", () => {
    it("accepts a distance equal to the coverage", () => {
        expect(() => assertWithinCoverage(5, 5)).not.toThrow();
    });

    it("rejects a distance beyond the coverage", () => {
        expect(() => assertWithinCoverage(5.01, 5)).toThrow("melebihi 5 km");
    });
});
