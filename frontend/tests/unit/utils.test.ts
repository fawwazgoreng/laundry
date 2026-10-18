import { describe, expect, it } from "bun:test";
import {
    cx,
    formatRupiah,
    formatNumber,
    formatDateTime,
    formatDateLong,
    toLocalInputValue,
    fromLocalInputValue,
    timeAgo,
    orderStatusLabel,
} from "../../src/lib/utils";

describe("formatRupiah", () => {
    it("formats using id-ID grouping", () => {
        expect(formatRupiah(1234567)).toBe("Rp 1.234.567");
    });

    it("rounds decimals and handles negative, to cents", () => {
        expect(formatRupiah(1234.56)).toBe("Rp 1.235");
        expect(formatRupiah(-0.4)).toBe("Rp 0");
        expect(formatRupiah(0)).toBe("Rp 0");
    });

    it("can omit the symbol", () => {
        expect(formatRupiah(25000, false)).toBe("25.000");
    });

    it("tolerates nullish values", () => {
        expect(formatRupiah(undefined as unknown as number)).toBe("Rp 0");
        expect(formatRupiah(null as unknown as number)).toBe("Rp 0");
    });
});

describe("formatNumber", () => {
    it("formats with thousands separators", () => {
        expect(formatNumber(12000)).toBe("12.000");
    });
});

describe("dates", () => {
    it("renders a long date in Indonesian", () => {
        expect(formatDateLong("2026-09-08T00:00:00")).toContain("September");
        expect(formatDateLong("2026-09-08T00:00:00")).toContain("2026");
    });

    it("returns - for invalid or missing dates", () => {
        expect(formatDateLong(null)).toBe("-");
        expect(formatDateLong("garbage")).toBe("-");
        expect(formatDateTime(null)).toBe("-");
    });

    it("renders weekday + time for formatDateTime", () => {
        const out = formatDateTime("2026-09-08T10:30:00");
        expect(out).toContain("Sep");
        expect(out).toContain("10");
    });
});

describe("input value helpers", () => {
    it("round-trips a local datetime value", () => {
        const iso = fromLocalInputValue("2026-09-08T10:30");
        expect(iso).toBe(new Date("2026-09-08T10:30").toISOString());
        expect(toLocalInputValue(iso)).toBe("2026-09-08T10:30");
    });

    it("returns an empty string for missing inputs", () => {
        expect(toLocalInputValue(null)).toBe("");
        expect(fromLocalInputValue("")).toBe("");
        expect(fromLocalInputValue("nope")).toBe("");
    });
});

describe("timeAgo", () => {
    it("describes relative time in Indonesian", () => {
        expect(timeAgo(new Date(Date.now() - 30_000))).toBe("baru saja");
        expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe("5 menit lalu");
        expect(timeAgo(new Date(Date.now() - 3 * 3600_000))).toBe("3 jam lalu");
        expect(timeAgo(new Date(Date.now() - 2 * 86400_000))).toBe("2 hari lalu");
    });
});

describe("orderStatusLabel", () => {
    it("maps known statuses and falls back to the raw value", () => {
        expect(orderStatusLabel("SIAP_ANTAR")).toBe("Siap Antar");
        expect(orderStatusLabel("MYSTERY")).toBe("MYSTERY");
    });
});

describe("cx", () => {
    it("joins truthy classes only", () => {
        expect(cx("a", false, "b", null, undefined, "c")).toBe("a b c");
    });
});