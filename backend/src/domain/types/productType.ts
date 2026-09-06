export type produckCreateType = {
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    is_active: boolean
}

export type produckUpdateType = {
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    isa_ctive: boolean
}

export interface serviceType {
    id: string
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    isa_ctive: boolean
}
