import { userEntity } from "../../domain/entities/userEntity";
import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { userRepository } from "../../domain/repositories/userRepository";
import type { userAuthType, userType } from "../../domain/types/userType";
import { AppError } from "../../helper/errorHandling/appError";

export class LoginUserUseCase {
    constructor(
        private readonly userRepository: userRepository,
        private readonly tokenRepository: tokenRepository,
        private readonly tokenIssuer: jwtTokenEntity,
    ) {}

    async execute(input: unknown): Promise<userAuthType> {
        const dto = userEntity.validateLogin(input);

        const user = await this.userRepository.findByEmail(dto.email);
        if (!user) {
            throw AppError.unauthorized("Invalid email or password");
        }

        const passwordMatches = await userEntity.verifyPassword(dto.password, user.password);
        if (!passwordMatches) {
            throw AppError.unauthorized("Invalid email or password");
        }

        const userSession = this.stripPassword(user);
        const accessToken = await this.tokenIssuer.generateAccessToken(userSession.id, userSession.role);
        const refreshToken = await this.tokenIssuer.generateRefreshToken(userSession.id, userSession.role);

        await this.tokenRepository.saveTokens(userSession.id, {
            accessToken,
            refreshToken,
            accessExpiresAt: this.tokenIssuer.accessExpiresAt(),
            refreshExpiresAt: this.tokenIssuer.refreshExpiresAt(),
        });

        return { user: userSession, accessToken, refreshToken };
    }

    private stripPassword(user: userType & { password: string }): userType {
        const { password: _password, ...safeUser } = user;
        return safeUser;
    }
}