import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_ACCESS_EXPIRES: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_EXPIRES: z.coerce.number().int().positive().default(604800),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_DIR: z.string().min(1).default("logs"),
    LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
    MIDTRANS_MERCHANT_ID: z.string().min(1),
    MIDTRANS_SERVER_KEY: z.string().min(1),
    MIDTRANS_CLIENT_KEY: z.string().min(1)

});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", JSON.stringify(parsed.error.flatten(), null, 2));
    throw new Error("Invalid environment variables");
}

export const env = parsed.data;