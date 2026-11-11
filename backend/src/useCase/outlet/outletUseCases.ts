import { z } from "zod";
import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { deliveryQuoteType, outletType, outletUpdateType } from "../../domain/types/outletType";
import { orderEntity } from "../../domain/entities/orderEntity";
import { AppError } from "../../helper/errorHandling/appError";
import { moneyInputSchema } from "../../lib/money";
import { roundDistanceKm, selectFarthestOutlet } from "../../lib/distanceCalc";
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

const deliveryQuoteSchema = z.object({
    latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
    longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
});

export class GetDeliveryQuoteUseCase {
    constructor(private readonly repository: outletRepository) {}

    async execute(input: unknown): Promise<deliveryQuoteType> {
        const parsed = deliveryQuoteSchema.safeParse(input);
        if (!parsed.success) {
            throw AppError.validation(parsed.error.flatten() as unknown as Record<string, unknown>);
        }

        const outlets = await this.repository.list();
        if (outlets.length === 0) throw AppError.notFound("Outlet belum dikonfigurasi");

        const farthest = selectFarthestOutlet(parsed.data, outlets);
        if (!farthest) throw AppError.notFound("Outlet belum dikonfigurasi");

        const distanceKm = roundDistanceKm(farthest.distanceKm);
        return {
            outlet: farthest.outlet,
            distance_km: distanceKm,
            delivery_fee: orderEntity.computeDeliveryFee(Math.ceil(distanceKm)),
            max_coverage_km: farthest.outlet.max_coverage_km,
            in_range: distanceKm <= farthest.outlet.max_coverage_km,
        };
    }
}

const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().regex(/^\+?[0-9\-]{8,15}$/).optional(),
    address_text: z.string().min(5).max(500).optional(),
    max_coverage_km: z.coerce.number().nonnegative().optional(),
    min_order_amount: moneyInputSchema.optional(),
    weekly_hours: z.string().max(500).optional(),
    latitude: z.coerce.number().min(-90).max(90, "Invalid latitude"),
    longitude: z.coerce.number().min(-180).max(180, "Invalid longitude"),
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