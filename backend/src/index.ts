import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./config/env";
import { handleAppError } from "./helper/errorHandling/errorResponse";
import { logger } from "./helper/logging/logger";
import { prisma } from "./infrastructure/prisma/prisma";
import { apiRateLimiter } from "./presentation/middleware/rateLimit";
import { requestLogging } from "./presentation/middleware/requestLogging";
import userRouter from "./presentation/routes/userRoute";
import type { AppVariables } from "./presentation/types";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", secureHeaders());
app.use(
    "*",
    cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    }),
);
app.use("*", requestLogging);
app.use("/api/*", apiRateLimiter);

app.get("/health", async (c) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return c.json({ success: true, status: "ok", database: "up" });
    } catch (error) {
        logger.error("health check failed", {
            message: error instanceof Error ? error.message : String(error),
        });
        return c.json({ success: false, status: "degraded", database: "down" }, 503);
    }
});

app.notFound((c) =>
    c.json(
        {
            success: false,
            status: 404,
            message: "Route not found",
            code: "NOT_FOUND",
            path: c.req.path,
            requestId: c.get("requestId"),
        },
        404,
    ),
);

app.onError((error, c) => handleAppError(error, c));

app.route("/api/v1/users", userRouter);

export default app;