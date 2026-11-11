import { describe, expect, it } from "bun:test";
import { fetchAllPages, pageSlice } from "../../src/lib/pagination";

describe("fetchAllPages", () => {
    it("mengambil semua halaman sampai lastPage", async () => {
        const calls: number[] = [];
        const data = await fetchAllPages(async (page) => {
            calls.push(page);
            return {
                data: [page, page + 10],
                meta: { lastPage: 3 },
            };
        }, 2);

        expect(calls).toEqual([1, 2, 3]);
        expect(data).toEqual([1, 11, 2, 12, 3, 13]);
    });

    it("berhenti di satu halaman bila meta tidak ada", async () => {
        const data = await fetchAllPages(async () => ({ data: ["a"] }));
        expect(data).toEqual(["a"]);
    });
});

describe("pageSlice", () => {
    const items = Array.from({ length: 23 }, (_, i) => i + 1);

    it("memotong data sesuai halaman dan perPage", () => {
        const result = pageSlice(items, 2, 10);
        expect(result.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
        expect(result.totalPages).toBe(3);
        expect(result.safePage).toBe(2);
    });

    it("membatasi halaman ke rentang yang valid", () => {
        expect(pageSlice(items, 99, 10).safePage).toBe(3);
        expect(pageSlice(items, 99, 10).items).toEqual([21, 22, 23]);
        expect(pageSlice(items, 0, 10).safePage).toBe(1);
    });

    it("mengembalikan satu halaman kosong untuk data kosong", () => {
        const result = pageSlice([], 1, 10);
        expect(result.items).toEqual([]);
        expect(result.totalPages).toBe(1);
        expect(result.safePage).toBe(1);
    });
});
