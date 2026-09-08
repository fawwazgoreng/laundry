import { z } from "zod";
import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { outletType, outletUpdateType } from "../../domain/types/outletType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class ListOutletsUseCase {
    constructor(private readonly repository: outletRepository) {}

    async execute(): Promise<outletType[]> {
        const data = await this.repository.list();
        logger.debug("outlets listed", { count: data.length });
        return data;
    }
}

export class GetOutletUseCase {
    constructor(private readonly repository: outletRepository) {}

    async execute(id: number): Promise<outletType> {
        const outlet = await this.repository.findById(id);
        if (!outlet) throw AppError.notFound("Outlet tidak ditemukan");
        return outlet;
    }

    async executeDefault(): Promise<outletType> {
        const outlet = await this.repository.findFirst();
        if (!outlet) throw AppError.notFound("Outlet belum dikonfigurasi");
        return outlet;
    }
}

const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().regex(/^\+?[0-9\-]{8,15}$/).optional(),
    address_text: z.string().min(5).max(500).optional(),
    max_coverage_km: z.coerce.number().nonnegative().optional(),
    min_order_amount: z.coerce.number().nonnegative().optional(),
    weekly_hours: z.string().max(500).optional(),
});

export class UpdateOutletUseCase {
    constructor(private readonly repository: outletRepository) {}

    async execute(id: number, input: unknown): Promise<outletType> {
        const parsed = updateSchema.safeParse(input);
        if (!parsed.success) {
            throw AppError.validation(parsed.error.flatten() as unknown as Record<string, unknown>);
        }
        const dto = parsed.data as outletUpdateType;
        const outlet = await this.repository.update(id, dto);
        if (!outlet) throw AppError.notFound("Outlet tidak ditemukan");
        logger.info("outlet updated", { outletId: id });
        return outlet;
    }
}