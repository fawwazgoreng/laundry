import { api } from "./apiClient"
import type {
    Address,
    AddressInput,
    AddonGroupInput,
    AddonOptionInput,
    AdminStats,
    AuthPayload,
    CashflowSummary,
    OrderCreateInput,
    OrderDetail,
    OrderListItem,
    OrderStatus,
    OrderTracking,
    Outlet,
    OutletInput,
    Payment,
    PaymentGate,
    Product,
    ProductInput,
    RefundSummary,
    Service,
    ServiceAddonGroup,
    ServiceInput,
    User,
} from "../lib/types"

export const authApi = {
    login: (email: string, password: string) =>
        api.post<AuthPayload>("/users/login", { email, password }),
    register: (data: { username: string; phone: string; email: string; password: string }) =>
        api.post<User>("/users/register", data),
    me: () => api.get<User>("/users/me"),
    logout: () => api.post<{ ok: boolean }>("/users/logout"),
    updateProfile: (data: { username?: string; phone?: string }) =>
        api.put<User>("/users/profile", data),
}

export const addressApi = {
    list: () => api.get<Address[]>("/addresses"),
    create: (data: AddressInput) => api.post<Address>("/addresses", data),
    update: (id: number, data: Partial<AddressInput>) => api.put<Address>(`/addresses/${id}`, data),
    remove: (id: number) => api.delete<{ ok: boolean }>(`/addresses/${id}`),
    setPrimary: (id: number) => api.patch<Address>(`/addresses/${id}/primary`),
}

export const serviceApi = {
    list: () => api.get<Service[]>("/services"),
    create: (data: ServiceInput) => api.post<Service>("/services", data),
    update: (id: number, data: Partial<ServiceInput>) => api.put<Service>(`/services/${id}`, data),
    remove: (id: number) => api.delete<{ ok: boolean }>(`/services/${id}`),
}

export const productApi = {
    list: (params?: {
        category?: string
        search?: string
        sort?: string
        page?: number
        perPage?: number
        inStockOnly?: boolean | string
    }) => api.page<Product[]>("/products", params as Record<string, string | number | undefined>),
    get: (id: number) => api.get<Product>(`/products/${id}`),
    create: (data: ProductInput) => api.post<Product>("/products", data),
    update: (id: number, data: Partial<ProductInput>) => api.put<Product>(`/products/${id}`, data),
    remove: (id: number) => api.delete<{ ok: boolean }>(`/products/${id}`),
    uploadImage: (id: number, file: File) => api.upload<Product>(`/products/${id}/image`, file),
}

export const addonApi = {
    listGroups: (includeInactive = true) =>
        api.get<ServiceAddonGroup[]>("/addons/groups", includeInactive ? { all: "true" } : undefined),
    createGroup: (data: AddonGroupInput) => api.post<ServiceAddonGroup>("/addons/groups", data),
    updateGroup: (id: number, data: Partial<AddonGroupInput>) =>
        api.put<ServiceAddonGroup>(`/addons/groups/${id}`, data),
    removeGroup: (id: number) => api.delete<{ ok: boolean }>(`/addons/groups/${id}`),
    createOption: (groupId: number, data: AddonOptionInput) =>
        api.post<ServiceAddonGroup>(`/addons/groups/${groupId}/options`, data),
    updateOption: (id: number, data: Partial<AddonOptionInput>) =>
        api.put<ServiceAddonGroup>(`/addons/options/${id}`, data),
    removeOption: (id: number) => api.delete<{ ok: boolean }>(`/addons/options/${id}`),
    targetGroups: (targetType: "service" | "product", targetId: number) =>
        api.get<number[]>(`/addons/targets/${targetType}/${targetId}`),
    setTargetGroups: (targetType: "service" | "product", targetId: number, groupIds: number[]) =>
        api.put<number[]>(`/addons/targets/${targetType}/${targetId}`, { group_ids: groupIds }),
}

export const outletApi = {
    list: () => api.get<Outlet[]>("/outlets"),
    getDefault: () => api.get<Outlet>("/outlets/default"),
    get: (id: number) => api.get<Outlet>(`/outlets/${id}`),
    update: (id: number, data: OutletInput) => api.put<Outlet>(`/outlets/${id}`, data),
}

export const orderApi = {
    create: (data: OrderCreateInput) => api.post<PaymentGate>("/orders", data),
    list: (params?: {
        search?: string
        customer?: string
        status?: string
        service?: string
        page?: number
        perPage?: number
    }) =>
        api.page<OrderListItem[]>("/orders", params),
    mine: (params?: {
        search?: string
        customer?: string
        status?: string
        service?: string
        page?: number
        perPage?: number
    }) => api.page<OrderListItem[]>("/orders", params),
    get: (orderId: string) => api.get<OrderDetail>(`/orders/${orderId}`),
    tracking: (orderId: string) => api.get<OrderTracking[]>(`/orders/${orderId}/tracking`),
    updateStatus: (orderId: string, status: OrderStatus) =>
        api.patch<OrderDetail>(`/orders/${orderId}/status`, { status }),
    cancel: (orderId: string) => api.patch<OrderDetail>(`/orders/${orderId}/cancel`),
    remove: (orderId: string) => api.delete<OrderDetail>(`/orders/${orderId}`),
}

export const paymentApi = {
    byOrder: (orderId: string) => api.get<Payment>(`/payments/order/${orderId}`),
}

export const refundApi = {
    create: (data: { order_id: string; reason: string }) => api.post<RefundSummary>("/refunds", data),
    decide: (id: string, data: { status: "APPROVED" | "REJECTED"; note?: string }) =>
        api.patch<RefundSummary>(`/refunds/${id}`, data),
}

export const adminApi = {
    stats: () => api.get<AdminStats>("/admin/stats"),
    cashflow: () => api.get<CashflowSummary>("/admin/cash-flow"),
}