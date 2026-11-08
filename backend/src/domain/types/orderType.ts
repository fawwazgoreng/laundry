import type { Money } from "../../lib/money";
import type { addonPriceMode } from "./serviceType";
import type { paymentStatus } from "./paymentType";
import type { refundSummaryType, refundStatus } from "./refundType";

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

export const ORDER_KINDS = ["PRODUCT", "SERVICE"] as const;
export type orderKind = (typeof ORDER_KINDS)[number];

export type serviceAddonInput = {
    group_code: string
    option_id: number
}

export type serviceOrderItemInput = {
    laundry_service_id: number
    qty: number
    notes?: string | undefined
    addons?: serviceAddonInput[] | undefined
}

export type serviceAddonRecord = {
    addon_option_id: number
    group_code: string
    group_name: string
    option_name: string
    price: Money
    price_mode: addonPriceMode
    qty: number
    subtotal: Money
}

export type productOrderItemInput = {
    product_id: number
    qty: number
    addons?: serviceAddonInput[] | undefined
}

export type serviceItemRecord = Omit<serviceOrderItemInput, "addons"> & {
    price_per_unit: Money
    addon_subtotal: Money
    addons: serviceAddonRecord[]
    subtotal: Money
}
export type productItemRecord = Omit<productOrderItemInput, "addons"> & {
    addons: serviceAddonRecord[]
    subtotal: Money
}

export type orderCreateType = {
    services: serviceOrderItemInput[]
    products: productOrderItemInput[]
    user_address_id: number
    outlet_id: number
    distance_km: number
    delivery_fee?: Money | undefined
    payment_method: paymentMethod
    bank?: "bca" | "bni" | "bri" | "permata" | "mandiri" | undefined
    notes?: string | undefined
}

export interface serviceOrderAddonType {
    id: string
    group_code: string
    group_name: string
    option_name: string
    price: Money
    price_mode: addonPriceMode
    qty: number
    subtotal: Money
}

export interface serviceOrderItemType {
    id: string
    service_id: number
    service_name: string
    unit: string
    qty: number
    price_per_unit: Money
    addon_subtotal: Money
    addons: serviceOrderAddonType[]
    subtotal: Money
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
    price: Money
    addons: serviceOrderAddonType[]
    subtotal: Money
}

export interface orderSummaryType {
    total_laundry: Money
    total_product: Money
    total_addon: Money
    delivery_fee: Money
    total_amount: Money
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
    gross_amount: Money
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
    order_type: orderKind
    refund_eligible: boolean
    payment_method: paymentMethod
    total_laundry: Money
    total_product: Money
    total_addon: Money
    delivery_fee: Money
    total_amount: Money
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
    refund: refundSummaryType | null
    trackings: orderTrackingType[]
}

export interface paymentGate {
    redirect_url?: string | undefined
    token?: string | undefined
    order_id: string
    va_number?: string | undefined
}

export type orderListFilters = {
    search?: string | undefined
    customer?: string | undefined
    status?: orderStatus | "all" | undefined
    service?: string | undefined
    page?: number | undefined
    perPage?: number | undefined
}

export interface orderListItemType {
    id: string
    order_id: string
    status: orderStatus
    order_type: orderKind
    refund_eligible: boolean
    refund_status: refundStatus | null
    total_amount: Money
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
    total_laundry: Money
    total_product: Money
    total_addon: Money
    delivery_fee: Money
    total_amount: Money
    item_count: number
}

export type orderNewPaymentType = {
    payment_type: paymentMethod
    gross_amount: Money
    status: paymentStatus
    transaction_id?: string
    va_number?: string | null
    paid_at?: string | null
    raw_response?: Record<string, unknown> | null
}

export type orderNewCashflowType = {
    type: "income" | "expense"
    category: string
    amount: Money
    description: string
}

export type orderNewRecordType = {
    order_id: string
    user_id: string
    outlet_id: number
    user_address_id: number
    distance_km: number
    delivery_fee: Money
    payment_method: paymentMethod
    notes?: string | undefined
    services: serviceItemRecord[]
    products: productItemRecord[]
    totals: orderTotalsType
    status: orderStatus
    tracking: { status: orderStatus; notes: string }
    payment: orderNewPaymentType
    cashflow?: orderNewCashflowType | null
}