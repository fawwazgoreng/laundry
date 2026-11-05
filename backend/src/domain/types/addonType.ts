import type { addonPriceMode, addonSelectionType } from "./serviceType";

export type addonTargetType = "service" | "product";

export type addonGroupCreateType = {
    code: string
    name: string
    selection_type: addonSelectionType
    is_required: boolean
    is_active: boolean
}

export type addonGroupUpdateType = Partial<Omit<addonGroupCreateType, "code">> & { code?: string }

export type addonOptionCreateType = {
    group_id: number
    name: string
    price: number
    price_mode: addonPriceMode
    is_default: boolean
    is_active: boolean
}

export type addonOptionUpdateType = Partial<Omit<addonOptionCreateType, "group_id">>
