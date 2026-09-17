export interface outletType {
    id: number
    name: string
    phone: string | null
    address_text: string | null
    latitude: number
    longitude: number
    max_coverage_km: number
    min_order_amount: number
    weekly_hours: string | null
}

export type outletUpdateType = {
    name?: string
    phone?: string
    address_text?: string
    max_coverage_km?: number
    min_order_amount?: number
    weekly_hours?: string
    latitude?: number
    longitude?: number
}