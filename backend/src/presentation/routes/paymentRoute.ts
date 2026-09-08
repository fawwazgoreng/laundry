import { Hono } from "hono";
import { paymentController } from "../controllers/paymentController";
import {
    ConfirmPaymentUseCase,
    GetOrderPaymentUseCase,
    ListUserPaymentsUseCase,
} from "../../useCase/payment/paymentUseCases";
import { authMiddleware, adminMiddleware, cashflowRepository, orderRepository, paymentRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new paymentController(
    new GetOrderPaymentUseCase(paymentRepository, orderRepository),
    new ConfirmPaymentUseCase(paymentRepository, cashflowRepository),
    new ListUserPaymentsUseCase(paymentRepository),
);

const paymentRouter = new Hono<{ Variables: AppVariables }>();

paymentRouter.use("*", authMiddleware);
paymentRouter.get("/", (c) => controller.list(c));
paymentRouter.post("/confirm", adminMiddleware, (c) => controller.confirm(c));
paymentRouter.get("/order/:orderId", (c) => controller.get(c));

export default paymentRouter;