import { formatIDR } from "./format"
import type { ServiceAddonOption } from "./types"

export interface SelectedServiceAddon {
    option: ServiceAddonOption
}

export function addonSubtotal(option: ServiceAddonOption, qty: number): number {
    return option.price * (option.price_mode === "per_unit" ? qty : 1)
}

export function selectedAddonsSubtotal(addons: SelectedServiceAddon[], qty: number): number {
    return addons.reduce((sum, addon) => sum + addonSubtotal(addon.option, qty), 0)
}

export function formatAddonPrice(option: ServiceAddonOption, unit = "kg"): string {
    return option.price_mode === "per_unit"
        ? `+${formatIDR(option.price)}/${unit}`
        : `+${formatIDR(option.price)}/order`
}
