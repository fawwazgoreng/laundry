import type { Money } from "../../lib/money";
import type { patchType } from "./globalType";

type outletPatchSource = Pick<outletType, "name" | "phone" | "address_text" | "max_coverage_km" | "min_order_amount" | "weekly_hours" | "latitude" | "longitude"> & { phone: string | undefined; address_text: string | undefined; weekly_hours: string | undefined };

export interface outletType {
    id: number
    name: string
    phone: string | null
    address_text: string | null
    latitude: number
    longitude: number
    max_coverage_km: number
    min_order_amount: Money
    weekly_hours: string | null
}

export type outletUpdateType = patchType<Omit<outletPatchSource, "id">>