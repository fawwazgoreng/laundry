
export type productCategory =
    | "Detergen"
    | "Softener"
    | "Pewangi"
    | "Pemutih"
    | "Paket Hemat";

export type productCreateType = {
    name: string
    category: productCategory
    price: number
    size: string
    stock: number
    is_active: boolean
}

export type productUpdateType = Partial<Omit<productCreateType, "name">> & { name?: string }

export interface productType {
    id: number
    name: string
    category: productCategory
    price: number
    size: string
    stock: number
    is_active: boolean
    image: string
}