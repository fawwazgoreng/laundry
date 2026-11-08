import { Decimal } from "decimal.js";
import { z } from "zod";

// Aturan pembulatan terpusat: satu kelas konfigurasi Decimal, digunakan semua modul.
Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -20,
    toExpPos: 20,
});

/**
 * Uang 2 desimal (mis. "12500.00"). Brand opsional: string biasa tetap lolos
 * secara statis, tetapi seluruh normalisasi/pembulatan tetap wajib melalui helper
 * money()/addMoney() dst yang memvalidasi regex dan presisi.
 */
export type Money = string & { readonly __brand?: "money" };

/**
 * Regex batas nilai uang DTO: maksimal 10 digit sebelum koma dan 2 digit sesudah koma.
 * Nilai maksimum: 9999999999.99.
 */
export const MONEY_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

/** Skema Zod untuk nilai uang pada batas DTO/API: string desimal maksimal 10 digit + 2 desimal. */
export const moneyInputSchema = z
    .string()
    .trim()
    .regex(MONEY_REGEX, "Harga harus berformat desimal: maksimal 10 digit sebelum koma dan 2 digit sesudah koma")
    .transform((value) => moneyFromDto(value));

export function isMoneyString(value: string): boolean {
    return MONEY_REGEX.test(value);
}

/** Normalisasi string apa pun (mis. "28000", "28000.5", "28000.555") menjadi uang 2 desimal. */
export function money(value: Decimal.Value): Money {
    const parsed = new Decimal(value);
    if (!parsed.isFinite()) throw new Error(`Invalid money value: ${String(value)}`);
    const normalized = parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const text = normalized.toFixed(2);
    if (!isMoneyString(text)) {
        throw new Error(`Money value out of range: ${text}`);
    }
    return text as Money;
}

/** Membuat uang dari string DTO tanpa menyentuh digit yang sudah valid. */
export function moneyFromDto(value: string): Money {
    if (!isMoneyString(value)) {
        throw new Error(`Invalid money format: ${value}`);
    }
    return money(value);
}

/** Jumlah angka desimal dari nilai numerik apa pun (untuk validasi kuantitas 2 desimal). */
export function decimalPlacesOf(value: Decimal.Value): number {
    return new Decimal(value).dp();
}

export function toDecimal(value: Money): Decimal {
    return new Decimal(value);
}

export function addMoney(...values: Array<Decimal.Value>): Money {
    let total = new Decimal(0);
    for (const value of values) total = total.plus(new Decimal(value));
    return money(total);
}

export function subtractMoney(a: Decimal.Value, b: Decimal.Value): Money {
    return money(new Decimal(a).minus(new Decimal(b)));
}

export function multiplyMoney(a: Decimal.Value, b: Decimal.Value): Money {
    return money(new Decimal(a).times(new Decimal(b)));
}

export function moneySum(values: Iterable<Decimal.Value>): Money {
    let total = new Decimal(0);
    for (const value of values) total = total.plus(new Decimal(value));
    return money(total);
}

/** Pembulatan terpusat; satu-satunya tempat ROUND_HALF_UP dipakai. */
export function roundMoney(value: Decimal.Value): Money {
    return money(new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
}

/** Nilai minimum: bila value < min maka dikembalikan min sebagai uang. */
export function clampMinMoney(value: Decimal.Value, min: Decimal.Value): Money {
    const parsed = new Decimal(value);
    return money(parsed.lessThan(min) ? new Decimal(min) : parsed);
}

/** Jumlah uang dari string kurir/gateway (Midtrans mengirim "25000.00"). */
export function parseGatewayMoney(value: unknown): Money | null {
    if (typeof value !== "string" || value === "" || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
    return money(value);
}
