import { ZodError } from "zod";
import { Prisma } from "../../infrastructure/src/generated/prisma/client";
import { AppError } from "./appError";

type sqlErrorShape = {
    kind?: unknown;
    sqlState?: unknown;
    constraint?: unknown;
};

function isSqlQueryError(error: unknown): error is { kind: "sql_query"; sqlState?: string; constraint?: string } {
    return typeof error === "object" && error !== null && (error as sqlErrorShape).kind === "sql_query";
}

function isSqlConnectionError(error: unknown): error is { kind: "sql_connection" } {
    return typeof error === "object" && error !== null && (error as sqlErrorShape).kind === "sql_connection";
}

export function mapToAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (error instanceof ZodError) {
        return AppError.fromZod(error);
    }

    if (error instanceof SyntaxError) {
        return AppError.badRequest("Malformed request body");
    }

    if (isSqlConnectionError(error)) {
        return new AppError(503, "DB_UNAVAILABLE", "Database connection unavailable");
    }

    if (isSqlQueryError(error)) {
        switch (error.sqlState) {
            case "23505":
                return new AppError(409, "DUPLICATE_RESOURCE", "A record with this value already exists", {
                    constraint: error.constraint,
                });
            case "23503":
                return new AppError(409, "FK_CONSTRAINT_VIOLATION", "Related record does not exist");
            case "23502":
                return AppError.validation(undefined, "Missing required value");
            case "23514":
                return AppError.validation(undefined, "Value violates a database constraint");
            default:
                return new AppError(500, "DATABASE_ERROR", `Database error (${error.sqlState ?? "unknown"})`, {
                    sqlState: error.sqlState,
                });
        }
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