import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { loginType, registerType } from "../types/userType";

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number");

export class userEntity {
    private static readonly registerSchema = z.object({
        username: z
            .string()
            .min(3, "Username must be at least 3 characters")
            .max(50, "Username must be at most 50 characters")
            .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores"),
        email: z.email({message: "Invalid email address"}).max(150),
        password: passwordSchema,
        phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Invalid phone number"),
    });

    private static readonly loginSchema = z.object({
        email: z.email({message: "Invalid email address"}).max(150),
        password: z.string().min(1, "Password is required"),
    });

    static validateRegister(input: unknown): registerType {
        return this.parse(this.registerSchema, input);
    }

    static validateLogin(input: unknown): loginType {
        return this.parse(this.loginSchema, input);
    }

    private static parse<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
        const result = schema.safeParse(input);
        if (!result.success) {
            throw AppError.validation(result.error.flatten() as unknown as Record<string, unknown>);
        }
        return result.data;
    }

    static hashPassword(password: string): Promise<string> {
        return Bun.password.hash(password);
    }

    static verifyPassword(password: string, hash: string): Promise<boolean> {
        return Bun.password.verify(password, hash);
    }
}