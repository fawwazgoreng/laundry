import type { Context } from "hono";
import { ok } from "../../helper/response/apiResponse";
import { parseIdParam } from "../../helper/http/queryParams";
import { GetDeliveryQuoteUseCase, GetOutletUseCase, ListOutletsUseCase, UpdateOutletUseCase } from "../../useCase/outlet/outletUseCases";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class outletController {
    constructor(
        private readonly listUseCase: ListOutletsUseCase,
        private readonly getUseCase: GetOutletUseCase,
        private readonly updateUseCase: UpdateOutletUseCase,
        private readonly deliveryQuoteUseCase: GetDeliveryQuoteUseCase,
    ) {}

    async list(c: Context): Promise<Response> {
        const data = await this.listUseCase.execute();
        return ok(c, data, "Daftar outlet");
    }

    async get(c: Context): Promise<Response> {
        const data = await this.getUseCase.execute(parseIdParam(c.req.param("id")));
        return ok(c, data, "Detail outlet");
    }

    async getDefault(c: Context): Promise<Response> {
        const data = await this.getUseCase.executeDefault();
        return ok(c, data, "Profil outlet");
    }

    async deliveryQuote(c: Context): Promise<Response> {
        const data = await this.deliveryQuoteUseCase.execute({
            latitude: c.req.query("latitude"),
            longitude: c.req.query("longitude"),
        });
        return ok(c, data, "Estimasi ongkir");
    }

    async update(c: AuthContext): Promise<Response> {
        const data = await this.updateUseCase.execute(parseIdParam(c.req.param("id")), await c.req.json());
        return ok(c, data, "Profil outlet diperbarui");
    }
}