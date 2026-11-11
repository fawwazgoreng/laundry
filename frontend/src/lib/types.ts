export interface ApiEnvelope<T = unknown> {
    success: boolean
    status: number
    code?: string
    message: string
    data: T
    details?: Record<string, unknown>
    meta?: Meta
}

export interface Meta {
    firstPage: number
    currentPage: number
    lastPage: number
    count: number
}

export interface User {
    id: string
    username: string
    email: string
    role: "user" | "admin"
    phone: string
    is_verified: boolean
    created_at?: string
}

export interface AuthTokens {
    accessToken: string
    refreshToken: string
}

export type AuthPayload = { user: User } & AuthTokens

export interface Address {
    id: number
    label: string
    address_text: string
    latitude: number
    longitude: number
    is_primary: boolean
    user_id: string
}

export type AddressInput = {
    label: string
    address_text: string
    latitude: number
    longitude: number
}

export type AddonSelectionType = "single" | "multiple"
export type AddonPriceMode = "per_unit" | "per_order"

// Uang selalu dikirim backend sebagai string desimal 2 digit (mis. "12500.00")
// agar tidak ada float di batas API.
export type Money = string

export interface ServiceAddonOption {
    id: number
    name: string
    price: Money
    price_mode: AddonPriceMode
    is_default: boolean
    is_active: boolean
    sort_order: number
}

export interface ServiceAddonGroup {
    id: number
    code: string
    name: string
    selection_type: AddonSelectionType
    is_required: boolean
    is_active: boolean
    sort_order: number
    options: ServiceAddonOption[]
}

export interface Service {
    id: number
    name: string
    unit: string
    price_per_unit: Money
    description: string
    estimated_duration_hours: number
    is_active: boolean
    addon_groups: ServiceAddonGroup[]
}

export type ServiceInput = {
    name: string
    unit: string
    price_per_unit: Money
    description: string
    estimated_duration_hours: number
    is_active: boolean
}

export interface Product {
    id: number
    name: string
    category: string
    price: Money
    size: string
    stock: number
    is_active: boolean
    image: string
    addon_groups: ServiceAddonGroup[]
}

export type ProductInput = {
    name: string
    category: string
    price: Money
    size: string
    stock: number
    is_active: boolean
}

export interface Outlet {
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

export interface DeliveryQuote {
    outlet: Outlet
    distance_km: number
    delivery_fee: Money
    max_coverage_km: number
    in_range: boolean
}

export type OutletInput = {
    name?: string
    phone?: string
    address_text?: string
    max_coverage_km?: number
    min_order_amount?: Money
    weekly_hours?: string
    latitude?: number
    longitude?: number
}

export type OrderStatus =
    | "BARU"
    | "DITERIMA"
    | "DIPROSES"
    | "SIAP_ANTAR"
    | "SELESAI"
    | "DIBATALKAN"

export type PaymentMethod =  "transfer_bank" | "cod"

export interface OrderItem {
    id: string
    qty: number
    subtotal: Money
}

export interface ServiceOrderAddon {
    id: string
    group_code: string
    group_name: string
    option_name: string
    price: Money
    price_mode: AddonPriceMode
    qty: number
    subtotal: Money
}

export interface ServiceOrderItem extends OrderItem {
    service_id: number
    service_name: string
    unit: string
    estimated_duration_hours: number
    price_per_unit: Money
    addon_subtotal: Money
    addons: ServiceOrderAddon[]
    notes: string
}

export interface ProductOrderItem extends OrderItem {
    product_id: number
    product_name: string
    category: string
    size: string
    image: string
    price: Money
    addon_subtotal: Money
    addons: ServiceOrderAddon[]
}

export interface OrderTracking {
    id: string
    status: OrderStatus
    notes: string
    estimated_completion_time: string | null
    created_at: string
}

export interface Payment {
    id: string
    transaction_id: string
    order_id: string
    payment_type: PaymentMethod
    gross_amount: Money
    status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "DIBATALKAN" | "REFUNDED" | "CANCELLED"
    paid_at: string | null
    raw_response: Record<string, unknown> | null
    created_at: string
    va_number?: string
}

export type OrderKind = "PRODUCT" | "SERVICE"
export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED"

export interface RefundSummary {
    id: string
    status: RefundStatus
    amount: Money
    reason: string
    gateway_ref: string | null
    requested_at: string
    processed_at: string | null
}

export interface OrderDetail {
    id: string
    order_id: string
    status: OrderStatus
    order_type: OrderKind
    refund_eligible: boolean
    payment_method: PaymentMethod
    total_laundry: Money
    total_product: Money
    total_addon: Money
    delivery_fee: Money
    discount_member: number
    discount_voucher: number
    total_amount: Money
    distance_km: number
    latitude: number | null
    longitude: number | null
    pickup_schedule: string | null
    estimated_delivery: string | null
    notes: string | null
    created_at: string
    updated_at: string
    customer: { id: string; username: string; phone: string }
    address: { id: number; label: string; address_text: string; latitude: number; longitude: number } | null
    outlet: { id: number; name: string; latitude: number; longitude: number } | null
    services: ServiceOrderItem[]
    products: ProductOrderItem[]
    payment: Payment | null
    refund: RefundSummary | null
    trackings: OrderTracking[]
}

export interface PaymentGate {
    order_id: string
    token: string
    redirect_url: string
    va_number?: string | null
}

export interface OrderListItem {
    id: string
    order_id: string
    status: OrderStatus
    order_type: OrderKind
    refund_eligible: boolean
    refund_status: RefundStatus | null
    total_amount: Money
    payment_method: PaymentMethod
    payment_status: Payment["status"] | null
    created_at: string
    customer_id: string
    customer_name: string
    customer_phone: string
    items_summary: string
    items_unit: string
}

export type OrderCreateInput = {
    services: Array<{
        laundry_service_id: number
        qty: number
        notes?: string
        addons?: Array<{ group_code: string; option_id: number }>
    }>
    products: Array<{ product_id: number; qty: number; addons?: Array<{ group_code: string; option_id: number }> }>
    user_address_id: number
    latitude?: number
    longitude?: number
    payment_method: PaymentMethod
    discount_member?: number
    discount_voucher?: number
    pickup_schedule: string
    bank?: "bca" | "mandiri" | "bni" | "bri"
    estimated_delivery: string
    notes?: string
}

export interface AdminStats {
    orders_today: number
    revenue_today: Money
    laundry_in_progress: number
    products_sold: number
    recent_orders: Array<{
        order_id: string
        customer_name: string
        customer_phone: string
        status: string
        total_amount: Money
        items_summary: string
        created_at: string
    }>
    service_revenue: Array<{ service_name: string; total: Money; count: number }>
    weekly_revenue: Array<{ date: string; total: Money }>
    low_stock_products: Array<{ id: number; name: string; stock: number }>
}

export interface AddonGroupInput {
    code: string
    name: string
    selection_type: AddonSelectionType
    is_required: boolean
    is_active: boolean
}

export interface AddonOptionInput {
    name: string
    price: Money
    price_mode: AddonPriceMode
    is_default: boolean
    is_active: boolean
}

export interface CashflowItem {
    id: number
    order_id: string | null
    type: "income" | "expense"
    category: string
    amount: Money
    description: string
    created_at: string
}

export interface CashflowCategoryTotal {
    category: string
    total: Money
    count: number
}

export interface CashflowSection {
    total: Money
    categories: CashflowCategoryTotal[]
    items: CashflowItem[]
}

export interface CashflowSummary {
    total_income: Money
    total_expense: Money
    net_profit: Money
    balance: Money
    income: CashflowSection
    expense: CashflowSection
    items: CashflowItem[]
}