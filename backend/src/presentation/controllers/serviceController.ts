import type { Context } from "hono";
import { created, noContent, ok } from "../../helper/response/apiResponse";
import { parseIdParam } from "../../helper/http/queryParams";
import {
    CreateServiceUseCase,
    DeleteServiceUseCase,
    GetServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
} from "../../useCase/service/serviceUseCases";

export class serviceController {
    constructor(
        private readonly listUseCase: ListServicesUseCase,
        private readonly getUseCase: GetServiceUseCase,
        private readonly createUseCase: CreateServiceUseCase,
        private readonly updateUseCase: UpdateServiceUseCase,
        private readonly deleteUseCase: DeleteServiceUseCase,
    ) {}

    async list(c: Context): Promise<Response> {
        const includeInactive = c.req.query("all") === "true";
        const data = await this.listUseCase.execute(!includeInactive);
        return ok(c, data, "Daftar layanan");
    }

    async get(c: Context): Promise<Response> {
        const data = await this.getUseCase.execute(parseIdParam(c.req.param("id")));
        return ok(c, data, "Detail layanan");
    }

    async create(c: Context): Promise<Response> {
        const data = await this.createUseCase.execute(await c.req.json());
        return created(c, data, "Layanan berhasil dibuat");
    }

    async update(c: Context): Promise<Response> {
        const data = await this.updateUseCase.execute(parseIdParam(c.req.param("id")), await c.req.json());
        return ok(c, data, "Layanan berhasil diperbarui");
    }

    async remove(c: Context): Promise<Response> {
        await this.deleteUseCase.execute(parseIdParam(c.req.param("id")));
        return noContent(c);
    }
}