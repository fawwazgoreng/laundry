import { formatRupiah } from "./utils"

export function formatIDR(value: number): string {
    return formatRupiah(value)
}

export function formatFormError(details: any): string {
    let detail = "Terjadi kesalahan mohon coba lagi"
    if (details instanceof Object) {
        let objectDetail = Object.values(details.fieldErrors)[0]
        if (objectDetail instanceof Array) detail = objectDetail[0]
    }
    return detail
}