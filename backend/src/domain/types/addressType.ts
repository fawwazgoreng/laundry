export type addressCreateType = {
    label: string
    address_text: string
    latitude: number
    longitude: number
}

import type { patchType } from "./globalType";

export type addressUpdateType = patchType<addressCreateType>

export interface addressType {
    id: number
    label: string
    address_text: string
    latitude: number
    longitude: number
    is_primary: boolean
    user_id: string
}

export type Coordinate = {
    latitude: number,
    longitude: number
}