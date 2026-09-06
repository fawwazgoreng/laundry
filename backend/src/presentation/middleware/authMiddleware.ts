import type { MiddlewareHandler } from "hono";
import type { AuthUseCase } from "../../useCase/user/authUseCase";
import { AppError } from "../../helper/errorHandling/appError";
import type { AppVariables } from "../types";

export function createAuthMiddleware(authUseCase: AuthUseCase): MiddlewareHandler<{ Variables: AppVariables }> {
    return async (c, next) => {
        const header = c.req.header("Authorization");
        if (!header?.startsWith("Bearer ")) {
            throw AppError.unauthorized("Missing bearer token");
        }
        const token = header.slice("Bearer ".length).trim();
        if (!token) {
            throw AppError.unauthorized("Missing bearer token");
        }

        const user = await authUseCase.authenticate(token);
        c.set("user", user);
        c.set("userId", user.id);

        await next();
    };
}