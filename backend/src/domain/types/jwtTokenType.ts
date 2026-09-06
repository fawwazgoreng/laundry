import type { userRole } from "./userType";

export type { userRole };

export type tokenType = "access" | "refresh";

export interface tokenPayload {
    sub: string
    role: userRole
    type: tokenType
}

export interface accessTokenType {
    id: string
    user_id: string
    token: string
    expired_at: Date
    created_at: Date
}

export interface refreshTokenType {
    id: string
    user_id: string
    token: string
    expired_at: Date
    created_at: Date
}

export interface newTokenSet {
    accessToken: string
    refreshToken: string
    accessExpiresAt: Date
    refreshExpiresAt: Date
}