import { describe, expect, it } from "bun:test";
import {
    MONTH_SHORT,
    buildMonthlySeries,
    cashflowCategoryLabel,
    filterByRange,
    filterCashflowByScope,
    formatShortDate,
    isReportPrintScope,
    isWithinRange,
    reportScopeLabel,
    resolveReportRange,
    splitCashflow,
    summarizeCashflow,
    toDateInputValue,
} from "../../src/lib/report";
import type { CashflowItem } from "../../src/lib/types";

function cashflowItem(overrides: Partial<CashflowItem> & { id: number; created_at: string }): CashflowItem {
    return {
        order_id: null,
        type: "income",
        category: "sales",
        amount: 0,
        description: "",
        ...overrides,
    };
}

describe("resolveReportRange", () => {
    it("preset memakai rentang jumlah bulan terakhir", () => {
        const before = Date.now();
        const { start, end } = resolveReportRange("preset", 1, "", "");
        const after = Date.now();

        expect(end.getTime()).toBeGreaterThanOrEqual(before);
        expect(end.getTime()).toBeLessThanOrEqual(after);
        // Mulai dinormalisasi ke tengah malam agar inklusi hari pertama konsisten
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        // Panjang rentang = satu bulan kalender (28-31 hari), bukan 30 hari tetap
        const days = (end.getTime() - start.getTime()) / 86_400_000;
        expect(days).toBeGreaterThanOrEqual(27);
        expect(days).toBeLessThanOrEqual(32);
    });

    it("custom memakai awal hari dan akhir hari dari tanggal yang dipilih", () => {
        const { start, end } = resolveReportRange("custom", 1, "2024-03-01", "2024-03-31");

        expect(start.getFullYear()).toBe(2024);
        expect(start.getMonth()).toBe(2);
        expect(start.getDate()).toBe(1);
        expect(start.getHours()).toBe(0);
        expect(end.getFullYear()).toBe(2024);
        expect(end.getMonth()).toBe(2);
        expect(end.getDate()).toBe(31);
        expect(end.getHours()).toBe(23);
    });

    it("custom menukar tanggal bila mulai lebih besar dari selesai", () => {
        const { start, end } = resolveReportRange("custom", 1, "2024-03-31", "2024-03-01");

        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(31);
    });
});

describe("isWithinRange / filterByRange", () => {
    const range = { start: new Date(2024, 2, 1, 0, 0, 0), end: new Date(2024, 2, 31, 23, 59, 59) };

    it("memasukkan batas awal dan akhir", () => {
        expect(isWithinRange(new Date(2024, 2, 1, 0, 0, 0), range)).toBe(true);
        expect(isWithinRange(new Date(2024, 2, 31, 23, 59, 59), range)).toBe(true);
    });

    it("menolak tanggal di luar periode", () => {
        expect(isWithinRange(new Date(2024, 1, 29, 12, 0, 0), range)).toBe(false);
        expect(isWithinRange(new Date(2024, 3, 1, 0, 0, 0), range)).toBe(false);
    });

    it("menyaring baris berdasarkan created_at", () => {
        const rows = [
            { id: "a", created_at: new Date(2024, 2, 10).toISOString() },
            { id: "b", created_at: new Date(2024, 0, 10).toISOString() },
            { id: "c", created_at: new Date(2024, 3, 2).toISOString() },
        ];

        expect(filterByRange(rows, range).map((r) => r.id)).toEqual(["a"]);
    });
});

describe("summarizeCashflow", () => {
    it("menghitung pendapatan, pengeluaran, dan saldo bersih", () => {
        const items = [
            cashflowItem({ id: 1, created_at: "2024-03-01T00:00:00.000Z", type: "income", amount: 50_000 }),
            cashflowItem({ id: 2, created_at: "2024-03-02T00:00:00.000Z", type: "expense", amount: 20_000 }),
            cashflowItem({ id: 3, created_at: "2024-03-03T00:00:00.000Z", type: "income", amount: 10_000 }),
        ];

        expect(summarizeCashflow(items)).toEqual({ income: 60_000, expense: 20_000, balance: 40_000 });
    });

    it("mengembalikan nol untuk periode tanpa transaksi", () => {
        expect(summarizeCashflow([])).toEqual({ income: 0, expense: 0, balance: 0 });
    });
});

describe("splitCashflow", () => {
    it("memisahkan pendapatan dan pengeluaran beserta subtotal dan net profit", () => {
        const items = [
            cashflowItem({ id: 1, created_at: "2024-03-01T00:00:00.000Z", type: "income", amount: 50_000 }),
            cashflowItem({ id: 2, created_at: "2024-03-02T00:00:00.000Z", type: "expense", amount: 20_000 }),
            cashflowItem({ id: 3, created_at: "2024-03-03T00:00:00.000Z", type: "income", amount: 10_000 }),
        ];

        const sections = splitCashflow(items);

        expect(sections.income.total).toBe(60_000);
        expect(sections.expense.total).toBe(20_000);
        expect(sections.net_profit).toBe(40_000);
        expect(sections.income.items.map((item) => item.id)).toEqual([3, 1]);
        expect(sections.expense.items.map((item) => item.id)).toEqual([2]);
    });

    it("menghitung subtotal per kategori di section masing-masing", () => {
        const items = [
            cashflowItem({ id: 1, created_at: "2024-03-01T00:00:00.000Z", type: "income", category: "sales", amount: 40_000 }),
            cashflowItem({ id: 2, created_at: "2024-03-02T00:00:00.000Z", type: "income", category: "sales", amount: 10_000 }),
            cashflowItem({ id: 3, created_at: "2024-03-03T00:00:00.000Z", type: "expense", category: "operational", amount: 15_000 }),
        ];

        const sections = splitCashflow(items);

        expect(sections.income.categories).toEqual([{ category: "sales", total: 50_000, count: 2 }]);
        expect(sections.expense.categories).toEqual([{ category: "operational", total: 15_000, count: 1 }]);
    });
});

describe("buildMonthlySeries", () => {
    it("mengisi satu titik per bulan dan menyisipkan bulan tanpa transaksi", () => {
        const range = { start: new Date(2024, 0, 1), end: new Date(2024, 2, 31) };
        const items = [
            cashflowItem({ id: 1, created_at: "2024-01-15T00:00:00.000Z", type: "income", amount: 100_000 }),
            cashflowItem({ id: 2, created_at: "2024-03-20T00:00:00.000Z", type: "expense", amount: 40_000 }),
        ];

        const series = buildMonthlySeries(items, range);

        expect(series).toHaveLength(3);
        expect(series.map((p) => p.label)).toEqual([MONTH_SHORT[0], MONTH_SHORT[1], MONTH_SHORT[2]]);
        expect(series[0]).toMatchObject({ income: 100_000, expense: 0 });
        expect(series[1]).toMatchObject({ income: 0, expense: 0 });
        expect(series[2]).toMatchObject({ income: 0, expense: 40_000 });
    });

    it("mengabaikan transaksi di luar rentang", () => {
        const range = { start: new Date(2024, 0, 1), end: new Date(2024, 0, 31) };
        const items = [
            cashflowItem({ id: 1, created_at: "2024-05-10T00:00:00.000Z", type: "income", amount: 999_000 }),
        ];

        expect(buildMonthlySeries(items, range)[0]).toMatchObject({ income: 0, expense: 0 });
    });
});

describe("cashflowCategoryLabel", () => {
    it("menerjemahkan kategori backend", () => {
        expect(cashflowCategoryLabel("sales")).toBe("Penjualan");
        expect(cashflowCategoryLabel("refund")).toBe("Pengembalian Dana");
    });

    it("mempertahankan nilai asli untuk kategori yang tidak dikenal", () => {
        expect(cashflowCategoryLabel("maintenance")).toBe("maintenance");
    });
});

describe("toDateInputValue", () => {
    it("menghasilkan format YYYY-MM-DD dengan padding", () => {
        expect(toDateInputValue(new Date(2024, 2, 5))).toBe("2024-03-05");
    });
});

describe("formatShortDate", () => {
    it("memuat tahun pada hasil format", () => {
        expect(formatShortDate(new Date(2024, 2, 5))).toContain("2024");
    });
});

describe("cakupan cetak laporan", () => {
    const items = [
        cashflowItem({ id: 1, created_at: "2024-03-01T00:00:00.000Z", type: "income", amount: 50_000 }),
        cashflowItem({ id: 2, created_at: "2024-03-02T00:00:00.000Z", type: "expense", amount: 20_000 }),
        cashflowItem({ id: 3, created_at: "2024-03-03T00:00:00.000Z", type: "income", amount: 10_000 }),
    ];

    it("memvalidasi nilai cakupan dari state router atau query", () => {
        expect(isReportPrintScope("all")).toBe(true);
        expect(isReportPrintScope("income")).toBe(true);
        expect(isReportPrintScope("expense")).toBe(true);
        expect(isReportPrintScope("both")).toBe(false);
        expect(isReportPrintScope(undefined)).toBe(false);
    });

    it("memberi label dokumen sesuai cakupan", () => {
        expect(reportScopeLabel("all")).toBe("Laporan Keuangan");
        expect(reportScopeLabel("income")).toBe("Laporan Pendapatan");
        expect(reportScopeLabel("expense")).toBe("Laporan Pengeluaran");
    });

    it("all mempertahankan semua baris tanpa menyalin array", () => {
        expect(filterCashflowByScope(items, "all")).toBe(items);
    });

    it("income dan expense hanya mengambil sisi yang dipilih", () => {
        expect(filterCashflowByScope(items, "income").map((item) => item.id)).toEqual([1, 3]);
        expect(filterCashflowByScope(items, "expense").map((item) => item.id)).toEqual([2]);
    });
});
