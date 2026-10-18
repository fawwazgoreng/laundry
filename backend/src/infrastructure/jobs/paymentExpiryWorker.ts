import { logger } from "../../helper/logging/logger";

export const PAYMENT_EXPIRY_INTERVAL_MS = 15 * 60 * 1000;

export function startPaymentExpiryWorker(run: () => Promise<unknown>): () => void {
    let running = false;
    const tick = async () => {
        if (running) {
            logger.warn("payment expiry worker skipped, previous run still in progress");
            return;
        }
        running = true;
        try {
            await run();
        } catch (error) {
            logger.error("payment expiry worker crashed", {
                message: error instanceof Error ? error.message : String(error),
            });
        } finally {
            running = false;
        }
    };

    void tick();
    const timer = setInterval(tick, PAYMENT_EXPIRY_INTERVAL_MS);
    logger.info("payment expiry worker started", { intervalMs: PAYMENT_EXPIRY_INTERVAL_MS });

    return () => clearInterval(timer);
}
