import type { accessTokenType, newTokenSet, refreshTokenType } from "../types/jwtTokenType";

export interface tokenRepository {
    saveTokens(userId: string, tokens: newTokenSet): Promise<void>
    findValidAccessToken(token: string): Promise<accessTokenType | null>
    findValidRefreshToken(token: string): Promise<refreshTokenType | null>
    revokeUserTokens(userId: string): Promise<void>
}