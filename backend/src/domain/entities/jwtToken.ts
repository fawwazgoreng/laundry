import { sign, verify } from "hono/jwt";
import { AppError } from "../../helper/errorHandling/appError";
import type { tokenPayload, tokenType, userRole } from "../types/jwtTokenType";

export class jwtTokenEntity {
    constructor(
        private readonly secret: string,
        private readonly accessExpiresInSeconds: number,
        private readonly refreshExpiresInSeconds: number,
    ) {}

    accessExpiresAt(fromMs: number = Date.now()): Date {
        return new Date(fromMs + this.accessExpiresInSeconds * 1000);
    }

    refreshExpiresAt(fromMs: number = Date.now()): Date {
        return new Date(fromMs + this.refreshExpiresInSeconds * 1000);
    }

    async generateAccessToken(sub: string, role: userRole): Promise<string> {
        return this.sign({ sub, role, type: "access" }, this.accessExpiresInSeconds);
    }

    async generateRefreshToken(sub: string, role: userRole): Promise<string> {
        return this.sign({ sub, role, type: "refresh" }, this.refreshExpiresInSeconds);
    }

    async verifyToken(payloadToken: string, expectedType?: tokenType): Promise<tokenPayload> {
        try {
            const payload = await verify(payloadToken, this.secret, "HS256");
            const sub = payload.sub;
            const type = payload.type;
            if (typeof sub !== "string" || (type !== "access" && type !== "refresh")) {
                throw AppError.unauthorized("Invalid token");
            }
            if (expectedType && type !== expectedType) {
                throw AppError.forbidden("Invalid token type");
            }
            return { sub, role: payload.role as userRole, type };
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.unauthorized("Invalid or expired token");
        }
    }

    private async sign(payload: tokenPayload, expiresInSeconds: number): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        return sign(
            { ...payload, iat: now, exp: now + expiresInSeconds },
            this.secret,
            "HS256",
        );
    }
}