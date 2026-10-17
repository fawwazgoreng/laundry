import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { accessTokenType, newTokenSet, refreshTokenType } from "../../domain/types/jwtTokenType";
import { prisma } from "../prisma/prisma";
import { fromInstant, instant } from "../prisma/scalars";

export class pgTokenRepository implements tokenRepository {
    async saveTokens(userId: string, tokens: newTokenSet): Promise<void> {
        await prisma.transaction(async (tx) => {
            const previous = await tx.orm.public.User.where({ id: userId }).first();

            const access = await tx.orm.public.Access_token.create({
                user_id: userId,
                token: tokens.accessToken,
                expired_at: instant(tokens.accessExpiresAt),
            });
            const refresh = await tx.orm.public.Refresh_token.create({
                user_id: userId,
                token: tokens.refreshToken,
                expired_at: instant(tokens.refreshExpiresAt),
            });

            await tx.orm.public.User.where({ id: userId }).update({
                access_tokenId: access.id,
                refresh_tokenId: refresh.id,
            });

            if (previous?.access_tokenId) {
                await tx.orm.public.Access_token.where({ id: previous.access_tokenId }).delete();
            }
            if (previous?.refresh_tokenId) {
                await tx.orm.public.Refresh_token.where({ id: previous.refresh_tokenId }).delete();
            }
        });
    }

    async findValidAccessToken(token: string): Promise<accessTokenType | null> {
        const row = await prisma.orm.public.Access_token
            .where({ token })
            .where((r) => r.expired_at.gt(instant(new Date())))
            .orderBy((r) => r.created_at.desc())
            .first();
        if (!row) return null;
        return {
            id: row.id,
            user_id: row.user_id,
            token: row.token,
            expired_at: fromInstant(row.expired_at),
            created_at: fromInstant(row.created_at),
        };
    }

    async findValidRefreshToken(token: string): Promise<refreshTokenType | null> {
        const row = await prisma.orm.public.Refresh_token
            .where({ token })
            .where((r) => r.expired_at.gt(instant(new Date())))
            .orderBy((r) => r.created_at.desc())
            .first();
        if (!row) return null;
        return {
            id: row.id,
            user_id: row.user_id,
            token: row.token,
            expired_at: fromInstant(row.expired_at),
            created_at: fromInstant(row.created_at),
        };
    }

    async revokeUserTokens(userId: string): Promise<void> {
        await prisma.transaction(async (tx) => {
            const current = await tx.orm.public.User.where({ id: userId }).first();

            if (current?.access_tokenId) {
                await tx.orm.public.Access_token.where({ id: current.access_tokenId }).delete();
            }
            if (current?.refresh_tokenId) {
                await tx.orm.public.Refresh_token.where({ id: current.refresh_tokenId }).delete();
            }

            await tx.orm.public.User.where({ id: userId }).update({
                access_tokenId: null,
                refresh_tokenId: null,
            });
        });
    }
}
