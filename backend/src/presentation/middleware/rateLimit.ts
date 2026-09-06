import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

const keyGenerator = (c: Context): string =>
    c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "anonymous";

const tooManyRequests = (c: Context) =>
    c.json(
        {
            success: false,
            status: 429,
            message: "Too many requests, please try again later",
            code: "RATE_LIMITED",
        },
        429,
    );

export const apiRateLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    keyGenerator,
    standardHeaders: "draft-6",
    handler: tooManyRequests,
});

export const authRateLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator,
    standardHeaders: "draft-6",
    handler: tooManyRequests,
});