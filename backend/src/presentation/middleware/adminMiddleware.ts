import type { MiddlewareHandler } from "hono";
import { AppError } from "../../helper/errorHandling/appError";
import type { AppVariables } from "../types";

export function createAdminMiddleware(
    authMiddleware: MiddlewareHandler<{ Variables: AppVariables }>,
): MiddlewareHandler<{ Variables: AppVariables }> {
    return async (c, next) => {
        await authMiddleware(c, async () => {
            const user = c.get("user");
            if (user.role !== "admin") {
                throw AppError.forbidden("Admin access required");
            }
            await next();
        });
    };
}