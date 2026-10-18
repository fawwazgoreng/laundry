import { z } from "zod";

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly messageCode: string,
        message?: string,
        public readonly details?: ErrorDetails,
    ) {
        super(message ?? "Something went wrong");
        this.name = "AppError";
    }

    static badRequest(message = "Bad request", details?: ErrorDetails): AppError {
        return new AppError(400, "BAD_REQUEST", message, details);
    }

    static unauthorized(message = "Unauthorized"): AppError {
        return new AppError(401, "UNAUTHORIZED", message);
    }

    static forbidden(message = "Forbidden"): AppError {
        return new AppError(403, "FORBIDDEN", message);
    }

    static notFound(message = "Resource not found"): AppError {
        return new AppError(404, "NOT_FOUND", message);
    }

    static conflict(message = "Resource conflict", details?: ErrorDetails): AppError {
        return new AppError(409, "CONFLICT", message, details);
    }

    static validation(details?: ErrorDetails, message = "Validation failed"): AppError {
        return new AppError(422, "VALIDATION_ERROR", message, details);
    }

    static tooManyRequests(message = "Too many requests, please try again later"): AppError {
        return new AppError(429, "RATE_LIMITED", message);
    }

    static internal(message = "Internal server error", details?: ErrorDetails): AppError {
        return new AppError(500, "INTERNAL_SERVER_ERROR", message, details);
    }

    static fromZod(error: z.ZodError, details?: ErrorDetails): AppError {
        const message = error.issues[0]?.message ?? "Validation failed";
        return new AppError(
            422,
            "VALIDATION_ERROR",
            message,
            details ?? (error.flatten() as unknown as ErrorDetails),
        );
    }
}