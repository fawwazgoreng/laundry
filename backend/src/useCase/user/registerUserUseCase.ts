import { userEntity } from "../../domain/entities/userEntity";
import type { userRepository } from "../../domain/repositories/userRepository";
import type { userType } from "../../domain/types/userType";
import { AppError } from "../../helper/errorHandling/appError";

export class RegisterUserUseCase {
    constructor(private readonly userRepository: userRepository) {}

    async execute(input: unknown): Promise<userType> {
        const dto = userEntity.validateRegister(input);

        const existingUser = await this.userRepository.findByEmail(dto.email);
        if (existingUser) {
            throw AppError.conflict("Email is already registered");
        }

        const hashedPassword = await userEntity.hashPassword(dto.password);
        return this.userRepository.create({ ...dto, password: hashedPassword });
    }
}