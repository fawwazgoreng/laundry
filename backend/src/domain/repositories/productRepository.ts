import type { productCategory, productCreateType, productType, productUpdateType } from "../types/productType";

export type productListOptions = {
    category?: productCategory | "all" | undefined
    search?: string | undefined
    sort?: "terbaru" | "terlama" | "termahal" | "termurah" | undefined
    page?: number
    perPage?: number
    inStockOnly?: boolean
}

export interface productRepository {
    list(opts?: productListOptions): Promise<{ data: productType[]; count: number }>
    findById(id: number): Promise<productType | null>
    create(data: productCreateType): Promise<productType>
    update(id: number, data: productUpdateType): Promise<productType | null>
    remove(id: number): Promise<boolean>
    updateImage(id: number, image: string): Promise<productType | null>
    decrementStock(id: number, qty: number): Promise<productType | null>
}