export interface adminStatsType {
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
    service_revenue: Array<{
        service_name: string
        total: number
        count: number
    }>
    weekly_revenue: Array<{
        date: string
        total: number
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
    amount: number
    description: string
    created_at: string
}

export interface cashflowCategoryTotalType {
    category: string
    total: number
    count: number
}

export interface cashflowSectionType {
    total: number
    categories: cashflowCategoryTotalType[]
    items: cashflowType[]
}

export interface cashflowSummaryType {
    total_income: number
    total_expense: number
    net_profit: number
    balance: number
    income: cashflowSectionType
    expense: cashflowSectionType
    items: cashflowType[]
}