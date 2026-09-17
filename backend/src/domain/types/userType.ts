export type userRole = "admin" | "user";

export type registerType = {
    username: string
    email: string
    password: string
    phone: string
}

export type loginType = {
    email: string
    password: string
}

export interface userType {
    id: string
    username: string
    email: string
    role: userRole
    phone: string
    is_verified: boolean
    created_at?: string
}

export interface userWithPassword extends userType {
    password: string
}

export interface userAuthType {
    user: userType
    accessToken: string
    refreshToken: string
}

export type addressType = {
    label: string
    address_text: string
    latitude: number
    longtitude: number
    is_primary: boolean
    user_id: string
}