import type { MiddlewareHandler } from "hono";
import { logger } from "../../helper/logging/logger";
import type { AppVariables } from "../types";

export const requestLogging: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? "anonymous";
    logger.info("request started", { requestId, method: c.req.method, path: c.req.path, ip });

    const start = performance.now();
    try {
        await next();
    } finally {
        const durationMs = Number((performance.now() - start).toFixed(1));
        logger.info("request completed", {
            requestId,
            method: c.req.method,
            path: c.req.path,
            status: c.res.status,
            durationMs,
            ip,
        });
    }
};