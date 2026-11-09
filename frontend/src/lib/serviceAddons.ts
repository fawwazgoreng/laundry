import { Decimal } from "decimal.js";
import { formatIDR } from "./format"
import type { ServiceAddonOption } from "./types"

export interface SelectedServiceAddon {
    option: ServiceAddonOption
}

// Semua matematika add-on memakai Decimal (2 desimal, ROUND_HALF_UP) supaya
// tidak ada hasil pecahan biner saat mencampur kuantitas pecahan.
export function addonSubtotal(option: ServiceAddonOption, qty: number): number {
    const multiplier = option.price_mode === "per_unit" ? qty : 1
    return new Decimal(option.price)
        .times(new Decimal(multiplier))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()
}

export function selectedAddonsSubtotal(addons: SelectedServiceAddon[], qty: number): number {
    let sum = new Decimal(0)
    for (const addon of addons) {
        sum = sum.plus(new Decimal(addonSubtotal(addon.option, qty)))
    }
    return sum.toNumber()
}

export function formatAddonPrice(option: ServiceAddonOption, unit = "kg"): string {
    return option.price_mode === "per_unit"
        ? `+${formatIDR(option.price)}/${unit}`
        : `+${formatIDR(option.price)}/order`
}
