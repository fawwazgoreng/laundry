import { Hono } from "hono";
import { serviceController } from "../controllers/serviceController";
import {
    CreateServiceUseCase,
    DeleteServiceUseCase,
    GetServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
} from "../../useCase/service/serviceUseCases";
import { adminMiddleware, serviceRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new serviceController(
    new ListServicesUseCase(serviceRepository),
    new GetServiceUseCase(serviceRepository),
    new CreateServiceUseCase(serviceRepository),
    new UpdateServiceUseCase(serviceRepository),
    new DeleteServiceUseCase(serviceRepository),
);

const serviceRouter = new Hono<{ Variables: AppVariables }>();

serviceRouter.get("/", (c) => controller.list(c));
serviceRouter.get("/:id", (c) => controller.get(c));
serviceRouter.post("/", adminMiddleware, (c) => controller.create(c));
serviceRouter.put("/:id", adminMiddleware, (c) => controller.update(c));
serviceRouter.delete("/:id", adminMiddleware, (c) => controller.remove(c));

export default serviceRouter;