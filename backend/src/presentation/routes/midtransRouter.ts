import { Hono } from "hono";
import type { AppVariables } from "../types";
import { handleMidtransNotificationUseCase } from "./container";

const midtransRouter = new Hono<{ Variables: AppVariables }>({strict: false});

// Public webhook endpoint — Midtrans calls this (no Bearer auth; it is
// protected by signature verification inside the use case).
midtransRouter.post("/notification", async (c) => {
    const raw = await c.req.json().catch(() => null);
    if (raw === null || typeof raw !== "object") {
        return c.json({ success: false, message: "Invalid notification payload" }, 400);
    }
    await handleMidtransNotificationUseCase.execute(raw as Record<string, unknown>);
    return c.text("OK", 200);
});

export default midtransRouter;