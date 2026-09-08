import type { adminStatsType } from "../types/adminType";

export interface statsRepository {
    getStats(): Promise<adminStatsType>
}