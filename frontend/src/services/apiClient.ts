import type { ApiEnvelope, AuthPayload, Meta } from "../lib/types";

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000/api";

export class ApiError extends Error {
    status: number
    code?: string
    details?: any

    constructor(message: string, status: number, code?: string, details?: any) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.code = code
        this.details = details
    }
}

const ACCESS_KEY = "fadarosi_access_token"
const REFRESH_KEY = "fadarosi_refresh_token"

export const tokenStore = {
    getAccess: () => localStorage.getItem(ACCESS_KEY),
    getRefresh: () => localStorage.getItem(REFRESH_KEY),
    set: (access: string, refresh: string) => {
        localStorage.setItem(ACCESS_KEY, access)
        localStorage.setItem(REFRESH_KEY, refresh)
    },
    clear: () => {
        localStorage.removeItem(ACCESS_KEY)
        localStorage.removeItem(REFRESH_KEY)
    },
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) return null
    const res = await fetch(`${API_BASE}/users/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    })
    const body = (await res.json()) as ApiEnvelope<AuthPayload>
    if (!res.ok || !body.success) {
        tokenStore.clear()
        return null
    }
    tokenStore.set(body.data.accessToken, body.data.refreshToken)
    return body.data.accessToken
}

async function request<T>(
    path: string,
    options: RequestInit = {},
    retry = true,
): Promise<{ data: T; meta?: Meta }> {
    const build = (token: string | null) => {
        const headers = new Headers(options.headers)
        if (options.body instanceof FormData) {
            headers.delete('Content-Type');
        } else if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        if (token) headers.set("Authorization", `Bearer ${token}`)
        return { ...options, headers }
    }

    let res = await fetch(`${API_BASE}${path}`, build(tokenStore.getAccess()))
    if (res.status === 401 && retry) {
        refreshPromise = refreshPromise ?? refreshAccessToken()
        const fresh = await refreshPromise
        refreshPromise = null
        if (fresh) {
            res = await fetch(`${API_BASE}${path}`, build(fresh))
        }
    }

    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null

    if (!res.ok) {
        throw new ApiError(
            body?.message ?? "Terjadi kesalahan pada server",
            res.status,
            typeof body?.status === "number" ? String(body.status) : undefined,
            body?.details
        )
    }

    if (body && !body.success) {
        throw new ApiError(body.message ?? "Terjadi kesalahan", res.status)
    }

    return { data: (body?.data as T) ?? (body as unknown as T), meta: body?.meta }
}

export const api = {
    get: <T>(path: string, params?: Record<string, string | number | undefined>) => {
        const qs = buildQuery(params)
        return request<T>(`${path}${qs ? `?${qs}` : ""}`).then((r) => r.data)
    },
    page: <T>(path: string, params?: Record<string, string | number | undefined>) => {
        const qs = buildQuery(params)
        return request<T>(`${path}${qs ? `?${qs}` : ""}`)
    },
    post: async <T>(path: string, body?: unknown) =>
        (await request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) })).data,
    put: async <T>(path: string, body?: unknown) =>
        (await request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) })).data,
    patch: async <T>(path: string, body?: unknown) =>
        (await request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) })).data,
    delete: async <T>(path: string) => (await request<T>(path, { method: "DELETE" })).data,
    upload: <T>(path: string, file: File) => {
        const form = new FormData()
        form.append("image", file)
        const headers = new Headers()
        const token = tokenStore.getAccess()
        if (token) headers.set("Authorization", `Bearer ${token}`)
        return request<T>(path, { method: "POST", body: form, headers }).then((r) => r.data)
    },
}

function buildQuery(params?: Record<string, string | number | undefined>) {
    if (!params) return ""
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
}