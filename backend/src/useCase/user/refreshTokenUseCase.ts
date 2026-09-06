import { z } from "zod";
import { userEntity } from "../../domain/entities/userEntity";
import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { userRepository } from "../../domain/repositories/userRepository";
import type { userAuthType } from "../../domain/types/userType";
import { AppError } from "../../helper/errorHandling/appError";

const refreshSchema = z.object({
    refreshToken: z.string().min(1, "refreshToken is required"),
});

export class RefreshTokenUseCase {
    constructor(
        private readonly userRepository: userRepository,
        private readonly tokenRepository: tokenRepository,
        private readonly tokenIssuer: jwtTokenEntity,
    ) {}

    async execute(input: unknown): Promise<userAuthType> {
        const parsed = refreshSchema.safeParse(input);
        if (!parsed.success) {
            throw AppError.validation(parsed.error.flatten() as unknown as Record<string, unknown>);
        }
        const { refreshToken } = parsed.data;

        const payload = await this.tokenIssuer.verifyToken(refreshToken, "refresh");
        const stored = await this.tokenRepository.findValidRefreshToken(refreshToken);
        if (!stored || stored.user_id !== payload.sub) {
            throw AppError.unauthorized("Invalid refresh token");
        }

        const user = await this.userRepository.findById(payload.sub);
        if (!user) {
            throw AppError.unauthorized("Account no longer exists");
        }

        const accessToken = await this.tokenIssuer.generateAccessToken(user.id, user.role);
        const newRefreshToken = await this.tokenIssuer.generateRefreshToken(user.id, user.role);

        await this.tokenRepository.saveTokens(user.id, {
            accessToken,
            refreshToken: newRefreshToken,
            accessExpiresAt: this.tokenIssuer.accessExpiresAt(),
            refreshExpiresAt: this.tokenIssuer.refreshExpiresAt(),
        });

        return { user, accessToken, refreshToken: newRefreshToken };
    }
}