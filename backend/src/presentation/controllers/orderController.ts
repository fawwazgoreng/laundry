import type { Context } from "hono";
import { created, ok } from "../../helper/response/apiResponse";
import {
    CancelOrderUseCase,
    CreateOrderUseCase,
    DeleteOrderUseCase,
    GetOrderUseCase,
    ListOrdersUseCase,
    UpdateOrderStatusUseCase,
} from "../../useCase/order/orderUseCases";
import type { orderListFilters } from "../../domain/types/orderType";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class orderController {
    constructor(
        private readonly createUseCase: CreateOrderUseCase,
        private readonly listUseCase: ListOrdersUseCase,
        private readonly getUseCase: GetOrderUseCase,
        private readonly updateStatusUseCase: UpdateOrderStatusUseCase,
        private readonly cancelUseCase: CancelOrderUseCase,
        private readonly deleteUseCase: DeleteOrderUseCase,
    ) {}

    async create(c: AuthContext): Promise<Response> {
        const data = await this.createUseCase.execute(c.get("userId"), await c.req.json());
        return created(c, data, "Pesanan berhasil dibuat");
    }

    async list(c: AuthContext): Promise<Response> {
        const user = c.get("user");
        const filters: orderListFilters = {
            search: c.req.query("search"),
            status: (c.req.query("status") ?? "all") as orderListFilters["status"],
            service: c.req.query("service"),
            page: c.req.query("page") ? Number(c.req.query("page")) : 1,
            perPage: c.req.query("perPage") ? Number(c.req.query("perPage")) : 10,
        };
        const { data, meta } = await this.listUseCase.execute(c.get("userId"), user.role, filters);
        return ok(c, data, "Daftar pesanan", meta);
    }

    async get(c: AuthContext): Promise<Response> {
        const user = c.get("user");
        const data = await this.getUseCase.execute(c.req.param("orderId")!, c.get("userId"), user.role);
        return ok(c, data, "Detail pesanan");
    }

    async getTracking(c: AuthContext): Promise<Response> {
        const user = c.get("user");
        const data = await this.getUseCase.execute(c.req.param("orderId")!, c.get("userId"), user.role);
        return ok(c, data.trackings, "Riwayat status pesanan");
    }

    async updateStatus(c: AuthContext): Promise<Response> {
        const data = await this.updateStatusUseCase.execute(
            c.req.param("orderId")!,
            await c.req.json(),
            c.get("userId"),
        );
        return ok(c, data, "Status pesanan diperbarui");
    }

    async cancel(c: AuthContext): Promise<Response> {
        const data = await this.cancelUseCase.execute(c.req.param("orderId")!, c.get("userId"));
        return ok(c, data, "Pesanan dibatalkan");
    }

    async remove(c: AuthContext): Promise<Response> {
        const data = await this.deleteUseCase.execute(c.req.param("orderId")!, c.get("userId"));
        return ok(c, data, "Pesanan dihapus");
    }
}