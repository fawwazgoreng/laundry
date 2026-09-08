import { Hono } from "hono";
import { adminController } from "../controllers/adminController";
import { AdminStatsUseCase, CashflowSummaryUseCase } from "../../useCase/admin/adminUseCases";
import { adminMiddleware, cashflowRepository, statsRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new adminController(
    new AdminStatsUseCase(statsRepository),
    new CashflowSummaryUseCase(cashflowRepository),
);

const adminRouter = new Hono<{ Variables: AppVariables }>();

adminRouter.use("*", adminMiddleware);
adminRouter.get("/stats", (c) => controller.stats(c));
adminRouter.get("/cash-flow", (c) => controller.cashflow(c));

export default adminRouter;