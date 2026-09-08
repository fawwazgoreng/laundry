import { z } from "zod";
import type { userRepository } from "../../domain/repositories/userRepository";
import type { userType } from "../../domain/types/userType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

const profileSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores").optional(),
    phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Invalid phone number").optional(),
});

export class UpdateProfileUseCase {
    constructor(private readonly userRepository: userRepository) {}

    async execute(userId: string, input: unknown): Promise<userType> {
        const parsed = profileSchema.safeParse(input);
        if (!parsed.success) {
            throw AppError.validation(parsed.error.flatten() as unknown as Record<string, unknown>);
        }
        if (!parsed.data.username && !parsed.data.phone) {
            throw AppError.validation({ detail: "Tidak ada data yang diubah" });
        }
        const user = await this.userRepository.updateProfile(userId, parsed.data);
        if (!user) throw AppError.notFound("Akun tidak ditemukan");
        logger.info("profile updated", { userId, fields: Object.keys(parsed.data) });
        return user;
    }
}