import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { addressCreateType, addressUpdateType } from "../types/addressType";

export class addressEntity {
    private static readonly createSchema = z.object({
        label: z.string().min(1, "Label is required").max(30, "Label max 30 characters"),
        address_text: z.string().min(5, "Alamat terlalu pendek").max(500, "Alamat max 500 characters"),
        latitude: z.coerce.number().min(-90).max(90, "Invalid latitude"),
        longitude: z.coerce.number().min(-180).max(180, "Invalid longitude"),
    });

    private static readonly updateSchema = this.createSchema.partial();

    static validateCreate(input: unknown): addressCreateType {
        return this.parse(this.createSchema, input);
    }

    static validateUpdate(input: unknown): addressUpdateType {
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