import type { orderRepository } from "../../../domain/repositories/orderRepository";
import type { orderListFilters, orderListItemType } from "../../../domain/types/orderType";
import type { meta } from "../../../domain/types/globalType";
import { logger } from "../../../helper/logging/logger";

function buildMeta(count: number, page: number, perPage: number): meta {
    return {
        firstPage: 1,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(count / perPage)),
        count,
    };
}

export class ListOrdersUseCase {
    constructor(private readonly orderRepository: orderRepository) { }

    async execute(
        userId: string,
        role: string,
        filters: orderListFilters = {},
    ): Promise<{ data: orderListItemType[]; meta: meta }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const result =
            role === "admin"
                ? await this.orderRepository.listAll({ ...filters, page, perPage })
                : await this.orderRepository.listByUser(userId, { ...filters, page, perPage });
        logger.debug("orders listed", {
            requestUserId: userId,
            role,
            count: result.count,
            page,
            perPage,
            filter: filters.status ?? "all",
        });
        return { data: result.data, meta: buildMeta(result.count, page, perPage) };
    }
}
