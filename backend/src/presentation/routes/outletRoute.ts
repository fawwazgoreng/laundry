import { Hono } from "hono";
import { outletController } from "../controllers/outletController";
import { GetDeliveryQuoteUseCase, GetOutletUseCase, ListOutletsUseCase, UpdateOutletUseCase } from "../../useCase/outlet/outletUseCases";
import { adminMiddleware, outletRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new outletController(
    new ListOutletsUseCase(outletRepository),
    new GetOutletUseCase(outletRepository),
    new UpdateOutletUseCase(outletRepository),
    new GetDeliveryQuoteUseCase(outletRepository),
);

const outletRouter = new Hono<{ Variables: AppVariables }>();

outletRouter.get("/", (c) => controller.list(c));
outletRouter.get("/default", (c) => controller.getDefault(c));
outletRouter.get("/delivery-quote", (c) => controller.deliveryQuote(c));
outletRouter.get("/:id", (c) => controller.get(c));
outletRouter.put("/:id", adminMiddleware, (c) => controller.update(c));

export default outletRouter;