export type addressCreateType = {
    label: string
    address_text: string
    latitude: number
    longitude: number
}

export type addressUpdateType = Partial<addressCreateType>

export interface addressType {
    id: number
    label: string
    address_text: string
    latitude: number
    longitude: number
    is_primary: boolean
    user_id: string
}