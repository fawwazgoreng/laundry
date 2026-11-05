import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./config/env";
import { handleAppError } from "./helper/errorHandling/errorResponse";
import { logger } from "./helper/logging/logger";
import { prisma } from "./infrastructure/prisma/prisma";
import { apiRateLimiter } from "./presentation/middleware/rateLimit";
import { requestLogging } from "./presentation/middleware/requestLogging";
import addressRouter from "./presentation/routes/addressRoute";
import adminRouter from "./presentation/routes/adminRoute";
import orderRouter from "./presentation/routes/orderRoute";
import addonRouter from "./presentation/routes/addonRoute";
import refundRouter from "./presentation/routes/refundRoute";
import outletRouter from "./presentation/routes/outletRoute";
import paymentRouter from "./presentation/routes/paymentRoute";
import productRouter from "./presentation/routes/productRoute";
import serviceRouter from "./presentation/routes/serviceRoute";
import userRouter from "./presentation/routes/userRoute";
import midtransRouter from "./presentation/routes/midtransRouter";
import { expirePendingPaymentsUseCase } from "./presentation/routes/container";
import { startPaymentExpiryWorker } from "./infrastructure/jobs/paymentExpiryWorker";
import type { AppVariables } from "./presentation/types";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin", }));
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
app.use("/uploads/*", serveStatic({ root: "./public" }));

const HEALTH_TIMEOUT_MS = 3000;

const describeError = (error: unknown) => {
    if (error instanceof Error) {
        const { code, sqlState } = error as Error & { code?: unknown; sqlState?: unknown };
        return { message: error.message, code, sqlState };
    }
    return { message: String(error) };
};

const withTimeout = async <T>(work: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`health check timeout ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
};

const healthPlan = prisma.raw.sql`SELECT 1 AS result`
    .returnsRow({ result: "pg/int4@1" })
    .build();

const runHealthQuery = async () => await prisma.runtime().query(healthPlan);

app.get("/health", async (c) => {
    try {
        const [row] = await withTimeout(runHealthQuery(), HEALTH_TIMEOUT_MS);

        if (row?.result === 1) {
            return c.json({ success: true, status: "ok", database: "up" });
        }

        logger.error("health check failed", { message: "Database response invalid", row });
        return c.json({ success: false, status: "degraded", database: "down" }, 503);
    } catch (error) {
        logger.error("health check failed", describeError(error));
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

app.route("/api/users", userRouter);
app.route("/api/addresses", addressRouter);
app.route("/api/outlets", outletRouter);
app.route("/api/services", serviceRouter);
app.route("/api/addons", addonRouter);
app.route("/api/products", productRouter);
app.route("/api/orders", orderRouter);
app.route("/api/payments", paymentRouter);
app.route("/api/refunds", refundRouter);
app.route("/api/admin", adminRouter);
app.route("/api/midtrans", midtransRouter);

if (import.meta.main) {
    const stopPaymentExpiryWorker = startPaymentExpiryWorker(() => expirePendingPaymentsUseCase.execute());

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info("shutting down", { signal });
        stopPaymentExpiryWorker();
        try {
            await prisma.close();
        } catch (error) {
            logger.error("failed to close database pool", {
                message: error instanceof Error ? error.message : String(error),
            });
        }
        process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
        logger.error("unhandled promise rejection", {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
        });
    });
    process.on("uncaughtException", (error) => {
        logger.error("uncaught exception", { message: error.message, stack: error.stack });
    });
}

export default app;