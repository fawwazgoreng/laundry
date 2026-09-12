import type { OrderStatus } from "./types";

export function formatRupiah(value: number, withSymbol = true): string {
    const rounded = Math.round(value ?? 0);
    const normalized = Object.is(rounded, -0) ? 0 : rounded;
    const formatted = new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0,
    }).format(normalized);
    return withSymbol ? `Rp ${formatted}` : formatted;
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat("id-ID").format(value ?? 0);
}

export function formatDateTime(value: string | Date | null): string {
    if (!value) return "-";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(d);
}

export function formatDateLong(value: string | Date | null): string {
    if (!value) return "-";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(d);
}

export function toLocalInputValue(value: string | Date | null): string {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "";
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

export function fromLocalInputValue(value: string): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
}

export function formatNumberWithComma(value: number): string {
    return new Intl.NumberFormat("id-ID").format(value);
}

export function timeAgo(value: string | Date): string {
    const d = typeof value === "string" ? new Date(value) : value;
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
}

export function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(" ");
}

export const ORDER_STATUSES: Array<{ value: OrderStatus; label: string }> = [
    { value: "BARU", label: "Baru" },
    { value: "DITERIMA", label: "Diterima" },
    { value: "DIPROSES", label: "Diproses" },
    { value: "SIAP_ANTAR", label: "Siap Antar" },
    { value: "SELESAI", label: "Selesai" },
    { value: "DIBATALKAN", label: "Dibatalkan" },
];

export function orderStatusLabel(status: string): string {
    return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    fadarosipay: "FADAROSI Pay / E-Wallet",
    transfer_bank: "Transfer Bank (Verifikasi Otomatis)",
    cod: "Bayar di Tempat (COD)",
};

export const PRODUCT_CATEGORIES = [
    "Detergen",
    "Softener",
    "Pewangi",
    "Pemutih",
    "Minyak Goreng",
    "Paket Hemat",
];

export const SORT_OPTIONS = [
    { value: "terbaru", label: "Terbaru" },
    { value: "terlama", label: "Terlama" },
    { value: "termahal", label: "Termahal" },
    { value: "termurah", label: "Termurah" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function combineClass(...classes: any[]): string {
    return cx(...classes);
}