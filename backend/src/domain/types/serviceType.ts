export type serviceCreateType = {
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
}

export type serviceUpdateType = Partial<Omit<serviceCreateType, "name">> & { name?: string }

export interface serviceType {
    id: number
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
}