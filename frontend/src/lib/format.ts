import { formatRupiah } from "./utils"

export function formatIDR(value: number): string {
    return formatRupiah(value)
}