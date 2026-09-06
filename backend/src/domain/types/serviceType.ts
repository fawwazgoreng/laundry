export type serviceCreateType = {
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    is_active: boolean
}

export type serviceUpdateType = {
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    is_active: boolean
}

export interface serviceType {
    id: string
    name: string
    unit: string
    price_per_unit: number
    estimation_duration_unit: number
    is_active: boolean
}
