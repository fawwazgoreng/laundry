import { Hono } from "hono";
import { addressController } from "../controllers/addressController";
import {
    CreateAddressUseCase,
    DeleteAddressUseCase,
    GetAddressUseCase,
    ListUserAddressesUseCase,
    SetPrimaryAddressUseCase,
    UpdateAddressUseCase,
} from "../../useCase/address/addressUseCases";
import { addressRepository, authMiddleware } from "./container";
import type { AppVariables } from "../types";

const controller = new addressController(
    new ListUserAddressesUseCase(addressRepository),
    new CreateAddressUseCase(addressRepository),
    new GetAddressUseCase(addressRepository),
    new UpdateAddressUseCase(addressRepository),
    new DeleteAddressUseCase(addressRepository),
    new SetPrimaryAddressUseCase(addressRepository),
);

const addressRouter = new Hono<{ Variables: AppVariables }>();

addressRouter.use("*", authMiddleware);
addressRouter.get("/", (c) => controller.list(c));
addressRouter.post("/", (c) => controller.create(c));
addressRouter.get("/:id", (c) => controller.get(c));
addressRouter.put("/:id", (c) => controller.update(c));
addressRouter.delete("/:id", (c) => controller.remove(c));
addressRouter.patch("/:id/primary", (c) => controller.setPrimary(c));

export default addressRouter;