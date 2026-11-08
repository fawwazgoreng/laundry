import type { Money } from "../../lib/money";

export interface adminStatsType {
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
    service_revenue: Array<{
        service_name: string
        total: Money
        count: number
    }>
    weekly_revenue: Array<{
        date: string
        total: Money
    }>
    low_stock_products: Array<{
        id: number
        name: string
        stock: number
    }>
}

export interface cashflowType {
    id: number
    order_id: string | null
    type: "income" | "expense"
    category: string
    amount: Money
    description: string
    created_at: string
}

export interface cashflowCategoryTotalType {
    category: string
    total: Money
    count: number
}

export interface cashflowSectionType {
    total: Money
    categories: cashflowCategoryTotalType[]
    items: cashflowType[]
}

export interface cashflowSummaryType {
    total_income: Money
    total_expense: Money
    net_profit: Money
    balance: Money
    income: cashflowSectionType
    expense: cashflowSectionType
    items: cashflowType[]
}