import type { tokenRepository } from "../../domain/repositories/tokenRepository";

export class LogoutUserUseCase {
    constructor(private readonly tokenRepository: tokenRepository) {}

    async execute(userId: string): Promise<void> {
        await this.tokenRepository.revokeUserTokens(userId);
    }
}