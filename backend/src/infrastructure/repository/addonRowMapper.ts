import type { addonPriceMode, addonSelectionType, serviceAddonGroupType } from "../../domain/types/serviceType";
import { money } from "../../lib/money";

export type AddonOptionRow = {
    id: number
    name: string
    price: string
    price_mode: string
    is_default: boolean
    is_active: boolean
};

export type AddonGroupRow = {
    id: number
    code: string
    name: string
    selection_type: string
    is_required: boolean
    is_active: boolean
    options: AddonOptionRow[]
};

export function toAddonGroup(row: AddonGroupRow, activeOnly: boolean): serviceAddonGroupType | null {
    if (activeOnly && !row.is_active) return null;
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        selection_type: row.selection_type as addonSelectionType,
        is_required: row.is_required,
        is_active: row.is_active,
        options: row.options
            .filter((option) => !activeOnly || option.is_active)
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((option) => ({
                id: option.id,
                name: option.name,
                price: money(option.price),
                price_mode: option.price_mode as addonPriceMode,
                is_default: option.is_default,
                is_active: option.is_active,
            })),
    };
}
