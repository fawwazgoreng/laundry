import { ZodError } from "zod";
import { Prisma } from "../../infrastructure/src/generated/prisma/client";
import { AppError } from "./appError";

export function mapToAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (error instanceof ZodError) {
        return AppError.validation(error.flatten() as unknown as Record<string, unknown>);
    }

    if (error instanceof SyntaxError) {
        return AppError.badRequest("Malformed request body");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2002":
                return new AppError(409, "DUPLICATE_RESOURCE", "A record with this value already exists", {
                    target: error.meta?.target,
                });
            case "P2003":
                return new AppError(409, "FK_CONSTRAINT_VIOLATION", "Related record does not exist");
            case "P2025":
                return new AppError(404, "NOT_FOUND", "Record not found");
            case "P2024":
                return new AppError(503, "DB_TIMEOUT", "Database connection timed out");
            case "P2034":
                return new AppError(409, "TRANSACTION_CONFLICT", "Database transaction conflict");
            default:
                return new AppError(500, "DATABASE_ERROR", `Database error (${error.code})`, {
                    prismaCode: error.code,
                });
        }
    }

    return AppError.internal();
}