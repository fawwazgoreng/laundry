import type { Money } from "../../lib/money";
import type { patchType } from "./globalType";
import type { addonPriceMode, addonSelectionType } from "./serviceType";

export type addonTargetType = "service" | "product";

export type addonGroupCreateType = {
    code: string
    name: string
    selection_type: addonSelectionType
    is_required: boolean
    is_active: boolean
}

export type addonGroupUpdateType = patchType<addonGroupCreateType>

export type addonOptionCreateType = {
    group_id: number
    name: string
    price: Money
    price_mode: addonPriceMode
    is_default: boolean
    is_active: boolean
}

export type addonOptionUpdateType = patchType<Omit<addonOptionCreateType, "group_id">>
