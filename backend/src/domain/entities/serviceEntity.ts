import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { serviceCreateType, serviceUpdateType } from "../types/serviceType";

export class serviceEntity {
    private static readonly createSchema = z.object({
        name: z.string().min(1, "Name is required").max(30, "Name max 30 characters"),
        unit: z.string().min(1, "Unit is required").max(10, "Unit max 10 characters"),
        price_per_unit: z.coerce.number().positive("Harga harus lebih dari 0"),
        description: z.string().max(500, "Description max 500 characters").default(""),
        estimated_duration_hours: z.coerce.number().int().positive("Estimasi waktu harus positif"),
        is_active: z.boolean().default(true),
    });

    private static readonly updateSchema = this.createSchema.partial();

    static validateCreate(input: unknown): serviceCreateType {
        return this.parse(this.createSchema, input);
    }

    static validateUpdate(input: unknown): serviceUpdateType {
        return this.parse(this.updateSchema, input);
    }

    private static parse<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
        const result = schema.safeParse(input);
        if (!result.success) {
            throw AppError.fromZod(result.error);
        }
        return result.data;
    }
}