import type { patchType } from "./globalType";
import type { Money } from "../../lib/money";
import type { serviceAddonGroupType } from "./serviceType";


export type productCategory =
    | "Detergen"
    | "Softener"
    | "Pewangi"
    | "Pemutih"
    | "Paket Hemat";

export type productCreateType = {
    name: string
    category: productCategory
    price: Money
    size: string
    stock: number
    is_active: boolean
}

export type productUpdateType = patchType<productCreateType>

export interface productType {
    id: number
    name: string
    category: productCategory
    price: Money
    size: string
    stock: number
    is_active: boolean
    image: string
    addon_groups: serviceAddonGroupType[]
}