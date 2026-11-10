import { Decimal } from "decimal.js";
import { formatIDR } from "./format"
import type { ServiceAddonOption } from "./types"

export interface SelectedServiceAddon {
    option: ServiceAddonOption
}

export interface AddonWithGroup {
    group: { code: string }
    option: ServiceAddonOption
}

// Kunci unik untuk add-on per_order lintas item. Add-on per_order hanya
// ditagih satu kali per pesanan dan diikat ke item pertama yang memilihnya.
export function perOrderAddonKey(addon: AddonWithGroup): string {
    return `${addon.group.code}:${addon.option.id}`
}

export function isPerOrderAddon(addon: AddonWithGroup): boolean {
    return addon.option.price_mode === "per_order"
}

// Add-on per_order bersifat level pesanan: hanya satu yang dipakai dan diikat
// ke item pertama pada urutan `lines`. Item berikutnya yang memilih add-on
// sama otomatis dilepas agar tidak tertagih ganda.
export function dedupePerOrderAddons<T extends { addons: AddonWithGroup[] }>(
    lines: T[],
    taken: Set<string> = new Set<string>(),
): T[] {
    return lines.map((line) => {
        const addons = line.addons.filter((addon) => {
            if (!isPerOrderAddon(addon)) return true
            const key = perOrderAddonKey(addon)
            if (taken.has(key)) return false
            taken.add(key)
            return true
        })
        return addons.length === line.addons.length ? line : { ...line, addons }
    })
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
