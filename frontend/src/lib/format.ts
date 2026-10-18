import { formatRupiah } from "./utils"

export function formatIDR(value: number): string {
    return formatRupiah(value)
}

export function formatFormError(details: unknown): string {
    let detail = "Terjadi kesalahan mohon coba lagi"
    if (details && typeof details === "object" && "fieldErrors" in details) {
        const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors
        if (fieldErrors && typeof fieldErrors === "object") {
            const first = Object.values(fieldErrors)[0]
            if (Array.isArray(first) && first[0]) detail = first[0]
        }
    }
    return detail
}