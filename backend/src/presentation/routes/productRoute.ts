import { Hono } from "hono";
import { productController } from "../controllers/productController";
import {
    CreateProductUseCase,
    DeleteProductUseCase,
    GetProductUseCase,
    ListProductsUseCase,
    UpdateProductUseCase,
    UploadProductImageUseCase,
} from "../../useCase/product/productUseCases";
import { adminMiddleware, productRepository } from "./container";
import type { AppVariables } from "../types";

const controller = new productController(
    new ListProductsUseCase(productRepository),
    new GetProductUseCase(productRepository),
    new CreateProductUseCase(productRepository),
    new UpdateProductUseCase(productRepository),
    new DeleteProductUseCase(productRepository),
    new UploadProductImageUseCase(productRepository),
);

const productRouter = new Hono<{ Variables: AppVariables }>();

productRouter.get("/", (c) => controller.list(c));
productRouter.get("/:id", (c) => controller.get(c));
productRouter.post("/", adminMiddleware, (c) => controller.create(c));
productRouter.post("/:id/image", adminMiddleware, (c) => controller.upload(c));
productRouter.put("/:id", adminMiddleware, (c) => controller.update(c));
productRouter.delete("/:id", adminMiddleware, (c) => controller.remove(c));

export default productRouter;