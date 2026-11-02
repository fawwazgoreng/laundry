import type { paymentStatus } from "./paymentType";

export const ORDER_STATUSES = [
    "BARU",
    "DITERIMA",
    "DIPROSES",
    "SIAP_ANTAR",
    "SELESAI",
    "DIBATALKAN",
] as const;

export type orderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["fadarosipay", "transfer_bank", "cod"] as const;
export type paymentMethod = (typeof PAYMENT_METHODS)[number];

export type serviceOrderItemInput = {
    laundry_service_id: number
    qty: number
    notes?: string
}

export type productOrderItemInput = {
    product_id: number
    qty: number
}

export type serviceItemRecord = serviceOrderItemInput & { subtotal: number }
export type productItemRecord = productOrderItemInput & { subtotal: number }

export type orderCreateType = {
    services: serviceOrderItemInput[]
    products: productOrderItemInput[]
    user_address_id: number
    outlet_id: number
    distance_km: number
    delivery_fee?: number
    payment_method: paymentMethod
    bank?: "bca" | "bni" | "bri" | "permata" | "mandiri"
    notes?: string
}

export interface serviceOrderItemType {
    id: string
    service_id: number
    service_name: string
    unit: string
    qty: number
    price_per_unit: number
    subtotal: number
    notes: string
}

export interface productOrderItemType {
    id: string
    product_id: number
    product_name: string
    category: string
    size: string
    image: string
    qty: number
    price: number
    subtotal: number
}

export interface orderSummaryType {
    total_laundry: number
    total_product: number
    delivery_fee: number
    total_amount: number
    item_count: number
}

export interface orderTrackingType {
    id: string
    status: orderStatus
    notes: string
    estimated_completion_time: string | null
    created_at: string
}

export interface paymentSummaryType {
    id: string
    transaction_id: string
    payment_type: paymentMethod
    gross_amount: number
    status: string
    va_number?: string | null
    paid_at: string | null
    created_at: string
    raw_response?: Record<string, unknown> | null
}

export interface orderDetailType {
    id: string
    order_id: string
    status: orderStatus
    payment_method: paymentMethod
    total_laundry: number
    total_product: number
    delivery_fee: number
    total_amount: number
    distance_km: number
    notes: string | null
    created_at: string
    updated_at: string
    customer: {
        id: string
        username: string
        phone: string
        email?: string
    }
    address: {
        id: number
        label: string
        address_text: string
    } | null
    outlet: {
        id: number
        name: string
        latitude: number
        longitude: number
    } | null
    services: serviceOrderItemType[]
    products: productOrderItemType[]
    payment: paymentSummaryType | null
    trackings: orderTrackingType[]
}

export interface paymentGate {
    redirect_url?: string
    token?: string
    order_id: string
    va_number?: string
}

export type orderListFilters = {
    search?: string
    customer?: string
    status?: orderStatus | "all"
    service?: string
    page?: number
    perPage?: number
}

export interface orderListItemType {
    id: string
    order_id: string
    status: orderStatus
    total_amount: number
    payment_method: paymentMethod
    payment_status: string | null
    created_at: string
    customer_id: string
    customer_name: string
    customer_phone: string
    items_summary: string
    items_unit: string
}

export interface orderTotalsType {
    total_laundry: number
    total_product: number
    delivery_fee: number
    total_amount: number
    item_count: number
}

export type orderNewPaymentType = {
    payment_type: paymentMethod
    gross_amount: number
    status: paymentStatus
    transaction_id?: string
    va_number?: string | null
    paid_at?: string | null
    raw_response?: Record<string, unknown> | null
}

export type orderNewCashflowType = {
    type: "income" | "expense"
    category: string
    amount: number
    description: string
}

export type orderNewRecordType = {
    order_id: string
    user_id: string
    outlet_id: number
    user_address_id: number
    distance_km: number
    delivery_fee: number
    payment_method: paymentMethod
    notes?: string
    services: serviceItemRecord[]
    products: productItemRecord[]
    totals: orderTotalsType
    status: orderStatus
    tracking: { status: orderStatus; notes: string }
    payment: orderNewPaymentType
    cashflow?: orderNewCashflowType | null
}