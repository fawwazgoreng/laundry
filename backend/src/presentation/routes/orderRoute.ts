import { Hono } from "hono";
import { orderController } from "../controllers/orderController";
import {
    CancelOrderUseCase,
    CreateOrderUseCase,
    DeleteOrderUseCase,
    GetOrderUseCase,
    ListOrdersUseCase,
    UpdateOrderStatusUseCase,
} from "../../useCase/order/orderUseCases";
import {
    addressRepository,
    adminMiddleware,
    authMiddleware,
    cashflowRepository,
    orderRepository,
    outletRepository,
    paymentRepository,
    productRepository,
    serviceRepository,
} from "./container";
import type { AppVariables } from "../types";

const controller = new orderController(
    new CreateOrderUseCase(
        orderRepository,
        serviceRepository,
        productRepository,
        addressRepository,
        outletRepository,
        paymentRepository,
        cashflowRepository,
    ),
    new ListOrdersUseCase(orderRepository),
    new GetOrderUseCase(orderRepository),
    new UpdateOrderStatusUseCase(orderRepository, paymentRepository, cashflowRepository),
    new CancelOrderUseCase(orderRepository, cashflowRepository, paymentRepository),
    new DeleteOrderUseCase(orderRepository),
);

const orderRouter = new Hono<{ Variables: AppVariables }>();

orderRouter.use("*", authMiddleware);
orderRouter.post("/", (c) => controller.create(c));
orderRouter.get("/", (c) => controller.list(c));
orderRouter.patch("/:orderId/status", adminMiddleware, (c) => controller.updateStatus(c));
orderRouter.patch("/:orderId/cancel", (c) => controller.cancel(c));
orderRouter.delete("/:orderId", (c) => controller.remove(c));
orderRouter.get("/:orderId/tracking", (c) => controller.getTracking(c));
orderRouter.get("/:orderId", (c) => controller.get(c));

export default orderRouter;