import type { Context } from "hono";
import { ok } from "../../helper/response/apiResponse";
import { AdminStatsUseCase, CashflowSummaryUseCase } from "../../useCase/admin/adminUseCases";

export class adminController {
    constructor(
        private readonly statsUseCase: AdminStatsUseCase,
        private readonly cashflowUseCase: CashflowSummaryUseCase,
    ) {}

    async stats(c: Context): Promise<Response> {
        const data = await this.statsUseCase.execute();
        return ok(c, data, "Ringkasan bisnis");
    }

    async cashflow(c: Context): Promise<Response> {
        const data = await this.cashflowUseCase.execute();
        return ok(c, data, "Laporan arus kas");
    }
}