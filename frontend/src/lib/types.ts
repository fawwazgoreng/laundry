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

export interface Service {
    id: number
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
}

export type ServiceInput = {
    name: string
    unit: string
    price_per_unit: number
    description: string
    estimated_duration_hours: number
    is_active: boolean
}

export interface Product {
    id: number
    name: string
    category: string
    price: number
    size: string
    stock: number
    is_active: boolean
    image: string
}

export type ProductInput = {
    name: string
    category: string
    price: number
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
    min_order_amount: number
    weekly_hours: string | null
}

export type OutletInput = {
    name?: string
    phone?: string
    address_text?: string
    max_coverage_km?: number
    min_order_amount?: number
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

export type PaymentMethod = "fadarosipay" | "transfer_bank" | "cod"

export interface OrderItem {
    id: string
    qty: number
    subtotal: number
}

export interface ServiceOrderItem extends OrderItem {
    service_id: number
    service_name: string
    unit: string
    price_per_unit: number
    notes: string
}

export interface ProductOrderItem extends OrderItem {
    product_id: number
    product_name: string
    category: string
    size: string
    image: string
    price: number
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
    gross_amount: number
    status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "DIBATALKAN" | "REFUNDED" | "CANCELLED"
    paid_at: string | null
    raw_response: Record<string, unknown> | null
    created_at: string
    va_number?: string
}

export interface OrderDetail {
    id: string
    order_id: string
    status: OrderStatus
    payment_method: PaymentMethod
    total_laundry: number
    total_product: number
    delivery_fee: number
    discount_member: number
    discount_voucher: number
    total_amount: number
    distance_km: number
    pickup_schedule: string | null
    estimated_delivery: string | null
    notes: string | null
    created_at: string
    updated_at: string
    customer: { id: string; username: string; phone: string }
    address: { id: number; label: string; address_text: string } | null
    outlet: { id: number; name: string; latitude: number; longitude: number } | null
    services: ServiceOrderItem[]
    products: ProductOrderItem[]
    payment: Payment | null
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
    total_amount: number
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
    services: Array<{ laundry_service_id: number; qty: number; notes?: string }>
    products: Array<{ product_id: number; qty: number }>
    user_address_id: number
    outlet_id: number
    distance_km: number
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
    revenue_today: number
    laundry_in_progress: number
    products_sold: number
    recent_orders: Array<{
        order_id: string
        customer_name: string
        customer_phone: string
        status: string
        total_amount: number
        items_summary: string
        created_at: string
    }>
    service_revenue: Array<{ service_name: string; total: number; count: number }>
    weekly_revenue: Array<{ date: string; total: number }>
    low_stock_products: Array<{ id: number; name: string; stock: number }>
}

export interface CashflowItem {
    id: number
    order_id: string | null
    type: "income" | "expense"
    category: string
    amount: number
    description: string
    created_at: string
}

export interface CashflowSummary {
    total_income: number
    total_expense: number
    balance: number
    items: CashflowItem[]
}