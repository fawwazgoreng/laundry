import { logger } from "../../helper/logging/logger";

export const PAYMENT_EXPIRY_INTERVAL_MS = 15 * 60 * 1000;

export function startPaymentExpiryWorker(run: () => Promise<unknown>): () => void {
    const tick = async () => {
        try {
            await run();
        } catch (error) {
            logger.error("payment expiry worker crashed", {
                message: error instanceof Error ? error.message : String(error),
            });
        }
    };

    void tick();
    const timer = setInterval(tick, PAYMENT_EXPIRY_INTERVAL_MS);
    logger.info("payment expiry worker started", { intervalMs: PAYMENT_EXPIRY_INTERVAL_MS });

    return () => clearInterval(timer);
}
