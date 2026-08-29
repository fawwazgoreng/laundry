export type serviceCreateType = {
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    is_active: Boolean
}

export type serviceUpdateType = {
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    is_active: Boolean
}

export interface serviceType {
    id: String
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    is_active: Boolean
}
