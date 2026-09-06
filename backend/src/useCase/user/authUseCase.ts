import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { userRepository } from "../../domain/repositories/userRepository";
import type { userType } from "../../domain/types/userType";
import { AppError } from "../../helper/errorHandling/appError";

export class AuthUseCase {
    constructor(
        private readonly userRepository: userRepository,
        private readonly tokenRepository: tokenRepository,
        private readonly tokenIssuer: jwtTokenEntity,
    ) {}

    async authenticate(accessToken: string): Promise<userType> {
        const payload = await this.tokenIssuer.verifyToken(accessToken, "access");

        const stored = await this.tokenRepository.findValidAccessToken(accessToken);
        if (!stored || stored.user_id !== payload.sub) {
            throw AppError.unauthorized("Token is revoked or expired");
        }

        const user = await this.userRepository.findById(payload.sub);
        if (!user) {
            throw AppError.unauthorized("Account no longer exists");
        }

        return user;
    }
}