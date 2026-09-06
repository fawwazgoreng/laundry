import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { accessTokenType, newTokenSet, refreshTokenType } from "../../domain/types/jwtTokenType";
import { prisma } from "../prisma/prisma";

export class pgTokenRepository implements tokenRepository {
    async saveTokens(userId: string, tokens: newTokenSet): Promise<void> {
        await prisma.$transaction(async (tx) => {
            const previous = await tx.user.findUnique({
                where: { id: userId },
                select: { access_tokenId: true, refresh_tokenId: true },
            });

            const access = await tx.access_token.create({
                data: { user_id: userId, token: tokens.accessToken, expired_at: tokens.accessExpiresAt },
            });
            const refresh = await tx.refresh_token.create({
                data: { user_id: userId, token: tokens.refreshToken, expired_at: tokens.refreshExpiresAt },
            });

            await tx.user.update({
                where: { id: userId },
                data: { access_tokenId: access.id, refresh_tokenId: refresh.id },
            });

            if (previous?.access_tokenId) {
                await tx.access_token.deleteMany({ where: { id: previous.access_tokenId } });
            }
            if (previous?.refresh_tokenId) {
                await tx.refresh_token.deleteMany({ where: { id: previous.refresh_tokenId } });
            }
        });
    }

    async findValidAccessToken(token: string): Promise<accessTokenType | null> {
        const row = await prisma.access_token.findFirst({
            where: { token, expired_at: { gt: new Date() } },
            orderBy: { created_at: "desc" },
        });
        if (!row) return null;
        return {
            id: row.id,
            user_id: row.user_id,
            token: row.token,
            expired_at: row.expired_at,
            created_at: row.created_at,
        };
    }

    async findValidRefreshToken(token: string): Promise<refreshTokenType | null> {
        const row = await prisma.refresh_token.findFirst({
            where: { token, expired_at: { gt: new Date() } },
            orderBy: { created_at: "desc" },
        });
        if (!row) return null;
        return {
            id: row.id,
            user_id: row.user_id,
            token: row.token,
            expired_at: row.expired_at,
            created_at: row.created_at,
        };
    }

    async revokeUserTokens(userId: string): Promise<void> {
        await prisma.$transaction(async (tx) => {
            const current = await tx.user.findUnique({
                where: { id: userId },
                select: { access_tokenId: true, refresh_tokenId: true },
            });

            if (current?.access_tokenId) {
                await tx.access_token.deleteMany({ where: { id: current.access_tokenId } });
            }
            if (current?.refresh_tokenId) {
                await tx.refresh_token.deleteMany({ where: { id: current.refresh_tokenId } });
            }

            await tx.user.update({
                where: { id: userId },
                data: { access_tokenId: null, refresh_tokenId: null },
            });
        });
    }
}