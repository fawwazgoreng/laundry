import { ZodError } from "zod";
import { AppError } from "./appError";

type sqlErrorShape = {
    kind?: unknown;
    sqlState?: unknown;
    code?: unknown;
    errno?: unknown;
    constraint?: unknown;
};

function isSqlQueryError(error: unknown): error is { kind: "sql_query"; sqlState?: string; code?: string | number; errno?: number; constraint?: string } {
    return typeof error === "object" && error !== null && (error as sqlErrorShape).kind === "sql_query";
}

function isSqlConnectionError(error: unknown): error is { kind: "sql_connection" } {
    return typeof error === "object" && error !== null && (error as sqlErrorShape).kind === "sql_connection";
}

function getMysqlCode(error: { code?: unknown; errno?: unknown }): string | undefined {
    if (typeof error.code === "string" || typeof error.code === "number") return String(error.code);
    if (typeof error.errno === "number") return String(error.errno);
    return undefined;
}

function isPrismaKnownRequestError(error: unknown): error is { code: string; meta?: unknown } {
    if (typeof error !== "object" || error === null) return false;
    const e = error as { code?: unknown; name?: unknown };
    return typeof e.code === "string" && /^P\d{4}$/.test(e.code);
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
        const code = getMysqlCode(error);
        switch (code ?? error.sqlState) {
            case "1062":
            case "ER_DUP_ENTRY":
            case "23505":
                return new AppError(409, "DUPLICATE_RESOURCE", "A record with this value already exists", {
                    constraint: error.constraint,
                });
            case "1451":
            case "1452":
            case "ER_ROW_IS_REFERENCED_2":
            case "ER_NO_REFERENCED_ROW_2":
            case "23503":
                return new AppError(409, "FK_CONSTRAINT_VIOLATION", "Related record constraint violation");
            case "1048":
            case "1364":
            case "ER_BAD_NULL_ERROR":
            case "ER_NO_DEFAULT_FOR_FIELD":
            case "23502":
                return AppError.validation(undefined, "Missing required value");
            case "3819":
            case "4025":
            case "ER_CHECK_CONSTRAINT_VIOLATED":
            case "23514":
                return AppError.validation(undefined, "Value violates a database constraint");
            default:
                return new AppError(500, "DATABASE_ERROR", `Database error (${code ?? error.sqlState ?? "unknown"})`, {
                    sqlState: error.sqlState,
                    code,
                });
        }
    }

    if (isPrismaKnownRequestError(error)) {
        const prismaCode = error.code;
        switch (prismaCode) {
            case "P2002":
                return new AppError(409, "DUPLICATE_RESOURCE", "A record with this value already exists", {
                    target: (error as any).meta?.target,
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
                return new AppError(500, "DATABASE_ERROR", `Database error (${prismaCode})`, {
                    prismaCode,
                });
        }
    }

    return AppError.internal();
}
