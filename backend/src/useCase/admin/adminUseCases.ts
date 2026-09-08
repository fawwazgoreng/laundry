import type { cashflowRepository } from "../../domain/repositories/cashflowRepository";
import type { statsRepository } from "../../domain/repositories/statsRepository";
import type { adminStatsType, cashflowSummaryType } from "../../domain/types/adminType";
import { logger } from "../../helper/logging/logger";

export class AdminStatsUseCase {
    constructor(private readonly statsRepository: statsRepository) {}

    async execute(): Promise<adminStatsType> {
        const stats = await this.statsRepository.getStats();
        logger.debug("admin stats fetched", {
            ordersToday: stats.orders_today,
            revenueToday: stats.revenue_today,
            inProgress: stats.laundry_in_progress,
        });
        return stats;
    }
}

export class CashflowSummaryUseCase {
    constructor(private readonly cashflowRepository: cashflowRepository) {}

    async execute(): Promise<cashflowSummaryType> {
        const summary = await this.cashflowRepository.summary();
        logger.debug("cashflow summary fetched", {
            totalIncome: summary.total_income,
            totalExpense: summary.total_expense,
        });
        return summary;
    }
}