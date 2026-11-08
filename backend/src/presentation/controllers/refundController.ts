import type { Context } from "hono";
import { created, ok } from "../../helper/response/apiResponse";
import { CreateRefundUseCase, DecideRefundUseCase } from "../../useCase/refund/index";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class refundController {
    constructor(
        private readonly createUseCase: CreateRefundUseCase,
        private readonly decideUseCase: DecideRefundUseCase,
    ) {}

    async create(c: AuthContext): Promise<Response> {
        const data = await this.createUseCase.execute(c.get("userId"), await c.req.json());
        return created(c, data, "Pengajuan refund berhasil dibuat");
    }

    async decide(c: AuthContext): Promise<Response> {
        const data = await this.decideUseCase.execute(
            c.req.param("id")!,
            await c.req.json(),
            c.get("userId"),
        );
        return ok(c, data, "Pengajuan refund diproses");
    }
}
