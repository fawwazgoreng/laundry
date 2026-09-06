import type { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppVariables } from "../../presentation/types";
import { logger } from "../logging/logger";
import { AppError } from "./appError";
import { mapToAppError } from "./errorMappings";

type ErrorContext = Context<{ Variables: AppVariables }>;

export function handleAppError(error: unknown, c: ErrorContext): Response {
    const appError = mapToAppError(error);
    const requestId = c.get("requestId");
    const base = { requestId, method: c.req.method, path: c.req.path };

    if (appError.statusCode >= 500) {
        logger.error("internal error", {
            ...base,
            status: appError.statusCode,
            code: appError.messageCode,
            stack: error instanceof Error ? error.stack : undefined,
        });
    } else {
        logger.warn("request failed", {
            ...base,
            status: appError.statusCode,
            code: appError.messageCode,
        });
    }

    const body: Record<string, unknown> = {
        success: false,
        status: appError.statusCode,
        message: appError.message,
        code: appError.messageCode,
        path: c.req.path,
        requestId,
    };
    if (appError.details) body.details = appError.details;

    return c.json(body, appError.statusCode as ContentfulStatusCode);
}

export { AppError };