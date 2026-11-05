import { Hono } from "hono";
import { addonController } from "../controllers/addonController";
import {
    CreateAddonGroupUseCase,
    CreateAddonOptionUseCase,
    DeleteAddonGroupUseCase,
    DeleteAddonOptionUseCase,
    GetTargetAddonGroupsUseCase,
    ListAddonGroupsUseCase,
    SetTargetAddonGroupsUseCase,
    UpdateAddonGroupUseCase,
    UpdateAddonOptionUseCase,
} from "../../useCase/addon/addonUseCases";
import { addonRepository, adminMiddleware, productRepository, serviceRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new addonController(
    new ListAddonGroupsUseCase(addonRepository),
    new CreateAddonGroupUseCase(addonRepository),
    new UpdateAddonGroupUseCase(addonRepository),
    new DeleteAddonGroupUseCase(addonRepository),
    new CreateAddonOptionUseCase(addonRepository),
    new UpdateAddonOptionUseCase(addonRepository),
    new DeleteAddonOptionUseCase(addonRepository),
    new GetTargetAddonGroupsUseCase(addonRepository),
    new SetTargetAddonGroupsUseCase(addonRepository, serviceRepository, productRepository),
);

const addonRouter = new Hono<{ Variables: AppVariables }>();

addonRouter.use("*", adminMiddleware);
addonRouter.get("/groups", (c) => controller.list(c));
addonRouter.post("/groups", (c) => controller.createGroup(c));
addonRouter.put("/groups/:id", (c) => controller.updateGroup(c));
addonRouter.delete("/groups/:id", (c) => controller.removeGroup(c));
addonRouter.post("/groups/:groupId/options", (c) => controller.createOption(c));
addonRouter.put("/options/:id", (c) => controller.updateOption(c));
addonRouter.delete("/options/:id", (c) => controller.removeOption(c));
addonRouter.get("/targets/:targetType/:targetId", (c) => controller.getTarget(c));
addonRouter.put("/targets/:targetType/:targetId", (c) => controller.setTarget(c));

export default addonRouter;
