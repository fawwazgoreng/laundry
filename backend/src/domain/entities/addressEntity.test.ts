import { describe, expect, it } from "bun:test";
import { addressEntity } from "./addressEntity";
import { AppError } from "../../helper/errorHandling/appError";

describe("addressEntity", () => {
    it("accepts a valid address", () => {
        const dto = addressEntity.validateCreate({
            label: "Rumah",
            address_text: "Jl. Melati No. 4, Jakarta",
            latitude: -6.2,
            longitude: 106.8,
        });
        expect(dto.label).toBe("Rumah");
    });

    it("rejects a short address text", () => {
        expect(() =>
            addressEntity.validateCreate({
                label: "Rumah",
                address_text: "Jl.",
                latitude: -6.2,
                longitude: 106.8,
            }),
        ).toThrow(AppError);
    });

    it("rejects out-of-range coordinates", () => {
        expect(() =>
            addressEntity.validateCreate({
                label: "Rumah",
                address_text: "Jl. Melati No. 4, Jakarta",
                latitude: 91,
                longitude: 106.8,
            }),
        ).toThrow(AppError);
    });

    it("accepts a partial update", () => {
        const dto = addressEntity.validateUpdate({ label: "Kantor" });
        expect(dto.label).toBe("Kantor");
        expect(dto.address_text).toBeUndefined();
    });
});