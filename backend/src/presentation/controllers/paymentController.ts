import type { Context } from "hono";
import { ok } from "../../helper/response/apiResponse";
import {
    ConfirmPaymentUseCase,
    GetOrderPaymentUseCase,
    ListUserPaymentsUseCase,
} from "../../useCase/payment/paymentUseCases";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class paymentController {
    constructor(
        private readonly getOrderPaymentUseCase: GetOrderPaymentUseCase,
        private readonly confirmUseCase: ConfirmPaymentUseCase,
        private readonly listUseCase: ListUserPaymentsUseCase,
    ) {}

    async get(c: AuthContext): Promise<Response> {
        const user = c.get("user");
        const data = await this.getOrderPaymentUseCase.execute(
            c.req.param("orderId")!,
            c.get("userId"),
            user.role,
        );
        return ok(c, data, "Detail pembayaran");
    }

    async confirm(c: AuthContext): Promise<Response> {
        const data = await this.confirmUseCase.execute(await c.req.json(), c.get("userId"));
        return ok(c, data, "Pembayaran diverifikasi");
    }

    async list(c: AuthContext): Promise<Response> {
        const data = await this.listUseCase.execute(c.get("userId"));
        return ok(c, data, "Daftar pembayaran");
    }
}