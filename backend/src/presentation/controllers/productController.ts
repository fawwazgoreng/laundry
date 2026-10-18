import type { Context } from "hono";
import { created, noContent, ok } from "../../helper/response/apiResponse";
import { parseIdParam, parsePage, parsePerPage } from "../../helper/http/queryParams";
import imageEntity from "../../domain/entities/imageEntity";
import {
    CreateProductUseCase,
    DeleteProductUseCase,
    GetProductUseCase,
    ListProductsUseCase,
    UpdateProductUseCase,
    UploadProductImageUseCase,
} from "../../useCase/product/productUseCases";
import type { productListOptions } from "../../domain/repositories/productRepository";

export class productController {
    private readonly imageHandler = new imageEntity("products");

    constructor(
        private readonly listUseCase: ListProductsUseCase,
        private readonly getUseCase: GetProductUseCase,
        private readonly createUseCase: CreateProductUseCase,
        private readonly updateUseCase: UpdateProductUseCase,
        private readonly deleteUseCase: DeleteProductUseCase,
        private readonly uploadImageUseCase: UploadProductImageUseCase,
    ) {}

    async list(c: Context): Promise<Response> {
        const opts: productListOptions = {
            category: (c.req.query("category") as productListOptions["category"]) ?? "all",
            search: c.req.query("search"),
            sort: (c.req.query("sort") as productListOptions["sort"]) ?? "terbaru",
            page: parsePage(c.req.query("page")),
            perPage: parsePerPage(c.req.query("perPage"), 12, 100),
            inStockOnly: c.req.query("inStockOnly") === "true",
        };
        const data = await this.listUseCase.execute(opts);
        return ok(c, data.data, "Daftar produk", {
            firstPage: 1,
            currentPage: data.page,
            lastPage: Math.max(1, Math.ceil(data.count / data.perPage)),
            count: data.count,
        });
    }

    async get(c: Context): Promise<Response> {
        const data = await this.getUseCase.execute(parseIdParam(c.req.param("id")));
        return ok(c, data, "Detail produk");
    }

    async create(c: Context): Promise<Response> {
        const data = await this.createUseCase.execute(await c.req.json());
        return created(c, data, "Produk berhasil dibuat");
    }

    async update(c: Context): Promise<Response> {
        const data = await this.updateUseCase.execute(parseIdParam(c.req.param("id")), await c.req.json());
        return ok(c, data, "Produk berhasil diperbarui");
    }

    async remove(c: Context): Promise<Response> {
        await this.deleteUseCase.execute(parseIdParam(c.req.param("id")));
        return noContent(c);
    }

    async upload(c: Context): Promise<Response> {
        const id = parseIdParam(c.req.param("id"));
        const body = await c.req.parseBody();
        const file = body["image"];
        if (!(file instanceof File)) {
            return c.json({ success: false, status: 422, message: "File 'image' tidak ditemukan", code: "VALIDATION_ERROR" }, 422);
        }
        const url = await this.imageHandler.save(file);
        const data = await this.uploadImageUseCase.execute(id, url);
        return ok(c, data, "Foto produk diperbarui");
    }
}