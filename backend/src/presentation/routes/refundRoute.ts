import { Hono } from "hono";
import { refundController } from "../controllers/refundController";
import { CreateRefundUseCase, DecideRefundUseCase } from "../../useCase/refund/index";
import {
    adminMiddleware,
    authMiddleware,
    cashflowRepository,
    orderRepository,
    paymentRepository,
    refundRepository,
} from "./container";
import type { AppVariables } from "../types";

const controller = new refundController(
    new CreateRefundUseCase(orderRepository, refundRepository),
    new DecideRefundUseCase(refundRepository, orderRepository, paymentRepository, cashflowRepository),
);

const refundRouter = new Hono<{ Variables: AppVariables }>();

refundRouter.use("*", authMiddleware);
refundRouter.post("/", (c) => controller.create(c));
refundRouter.patch("/:id", adminMiddleware, (c) => controller.decide(c));

export default refundRouter;
