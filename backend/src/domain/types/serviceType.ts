export type serviceCreateType = {
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
}

export type serviceUpdateType = Partial<Omit<serviceCreateType, "name">> & { name?: string }

export const ADDON_SELECTION_TYPES = ["single", "multiple"] as const
export type addonSelectionType = (typeof ADDON_SELECTION_TYPES)[number]

export const ADDON_PRICE_MODES = ["per_unit", "per_order"] as const
export type addonPriceMode = (typeof ADDON_PRICE_MODES)[number]

export interface serviceAddonOptionType {
    id: number
    name: string
    price: number
    price_mode: addonPriceMode
    is_default: boolean
    is_active: boolean
}

export interface serviceAddonGroupType {
    id: number
    code: string
    name: string
    selection_type: addonSelectionType
    is_required: boolean
    is_active: boolean
    options: serviceAddonOptionType[]
}

export interface serviceType {
    id: number
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
    addon_groups: serviceAddonGroupType[]
}