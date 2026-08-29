export type produckCreateType = {
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    is_active: Boolean
}

export type produckUpdateType = {
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    isa_ctive: Boolean
}

export interface serviceType {
    id: String
    name: String
    unit: String
    price_per_unit: Number
    estimation_duration_unit: Number
    isa_ctive: Boolean
}
