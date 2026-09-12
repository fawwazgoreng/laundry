import { describe, expect, it, mock } from "bun:test";
import { CreateAddressUseCase, DeleteAddressUseCase, UpdateAddressUseCase } from "./addressUseCases";
import type { addressRepository } from "../../domain/repositories/addressRepository";

const address = {
    id: 1,
    label: "Rumah",
    address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
    latitude: -6.2,
    longitude: 106.7,
    is_primary: true,
    user_id: "u-1",
};

const payload = {
    label: "Rumah",
    address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
    latitude: -6.2,
    longitude: 106.7,
};

describe("CreateAddressUseCase", () => {
    it("marks the first address as primary", async () => {
        const repo = {
            countByUser: mock(() => 0),
            create: mock(() => address),
        } as unknown as addressRepository;

        const created = await new CreateAddressUseCase(repo).execute("u-1", payload);
        expect(created.is_primary).toBe(true);
        expect(repo.create).toHaveBeenCalledWith("u-1", expect.anything(), true);
    });

    it("does not force primary when other addresses exist", async () => {
        const repo = {
            countByUser: mock(() => 2),
            create: mock(() => ({ ...address, is_primary: false })),
        } as unknown as addressRepository;

        const created = await new CreateAddressUseCase(repo).execute("u-1", payload);
        expect(created.is_primary).toBe(false);
        expect(repo.create).toHaveBeenCalledWith("u-1", expect.anything(), false);
    });
});

describe("UpdateAddressUseCase", () => {
    it("updates an existing address", async () => {
        const repo = {
            update: mock(() => ({ ...address, label: "Kantor" })),
        } as unknown as addressRepository;

        const updated = await new UpdateAddressUseCase(repo).execute("u-1", 1, { label: "Kantor" });
        expect(updated.label).toBe("Kantor");
    });

    it("throws when the address is missing", async () => {
        const repo = { update: mock(() => null) } as unknown as addressRepository;
        await expect(new UpdateAddressUseCase(repo).execute("u-1", 999, {})).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe("DeleteAddressUseCase", () => {
    it("removes an address", async () => {
        const repo = { remove: mock(() => true) } as unknown as addressRepository;
        await new DeleteAddressUseCase(repo).execute("u-1", 1);
        expect(repo.remove).toHaveBeenCalledWith("u-1", 1);
    });

    it("throws when the address is missing", async () => {
        const repo = { remove: mock(() => false) } as unknown as addressRepository;
        await expect(new DeleteAddressUseCase(repo).execute("u-1", 999)).rejects.toMatchObject({ statusCode: 404 });
    });
});