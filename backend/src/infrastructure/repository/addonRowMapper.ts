import type { addonPriceMode, addonSelectionType, serviceAddonGroupType } from "../../domain/types/serviceType";
import { money } from "../../lib/money";
import { isFlag } from "../prisma/scalars";

export type AddonOptionRow = {
    id: number
    name: string
    price: string
    price_mode: string
    is_default: number
    is_active: number
};

export type AddonGroupRow = {
    id: number
    code: string
    name: string
    selection_type: string
    is_required: number
    is_active: number
    options: AddonOptionRow[]
};

export function toAddonGroup(row: AddonGroupRow, activeOnly: boolean): serviceAddonGroupType | null {
    if (activeOnly && !isFlag(row.is_active)) return null;
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        selection_type: row.selection_type as addonSelectionType,
        is_required: isFlag(row.is_required),
        is_active: isFlag(row.is_active),
        options: row.options
            .filter((option) => !activeOnly || isFlag(option.is_active))
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((option) => ({
                id: option.id,
                name: option.name,
                price: money(option.price),
                price_mode: option.price_mode as addonPriceMode,
                is_default: isFlag(option.is_default),
                is_active: isFlag(option.is_active),
            })),
    };
}
