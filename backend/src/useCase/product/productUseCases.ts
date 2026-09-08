import { productEntity } from "../../domain/entities/productEntity";
import type { productRepository } from "../../domain/repositories/productRepository";
import type { productListOptions } from "../../domain/repositories/productRepository";
import type { productType } from "../../domain/types/productType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class ListProductsUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(opts: productListOptions = {}): Promise<{ data: productType[]; count: number; page: number; perPage: number }> {
        const page = opts.page ?? 1;
        const perPage = opts.perPage ?? 12;
        const result = await this.repository.list({ ...opts, page, perPage });
        logger.debug("products listed", { count: result.count, page, perPage, filter: opts.category ?? "all" });
        return { data: result.data, count: result.count, page, perPage };
    }
}

export class GetProductUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(id: number): Promise<productType> {
        const product = await this.repository.findById(id);
        if (!product) throw AppError.notFound("Produk tidak ditemukan");
        return product;
    }
}

export class CreateProductUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(input: unknown): Promise<productType> {
        const dto = productEntity.validateCreate(input);
        const product = await this.repository.create(dto);
        logger.info("product created", { productId: product.id, name: product.name });
        return product;
    }
}

export class UpdateProductUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(id: number, input: unknown): Promise<productType> {
        const dto = productEntity.validateUpdate(input);
        const product = await this.repository.update(id, dto);
        if (!product) throw AppError.notFound("Produk tidak ditemukan");
        logger.info("product updated", { productId: id });
        return product;
    }
}

export class DeleteProductUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(id: number): Promise<void> {
        const removed = await this.repository.remove(id);
        if (!removed) throw AppError.notFound("Produk tidak ditemukan");
        logger.info("product deactivated", { productId: id });
    }
}

export class UploadProductImageUseCase {
    constructor(private readonly repository: productRepository) {}

    async execute(id: number, imagePath: string): Promise<productType> {
        const product = await this.repository.updateImage(id, imagePath);
        if (!product) throw AppError.notFound("Produk tidak ditemukan");
        logger.info("product image updated", { productId: id, imagePath });
        return product;
    }
}