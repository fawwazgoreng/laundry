import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { addonGroupCreateType, addonGroupUpdateType, addonOptionCreateType, addonOptionUpdateType } from "../types/addonType";
import { ADDON_PRICE_MODES, ADDON_SELECTION_TYPES } from "../types/serviceType";

export class addonEntity {
    private static readonly groupCreateSchema = z.object({
        code: z.string().trim().min(1, "Kode add-on wajib diisi").max(30, "Kode maksimal 30 karakter"),
        name: z.string().trim().min(1, "Nama add-on wajib diisi").max(50, "Nama maksimal 50 karakter"),
        selection_type: z.enum(ADDON_SELECTION_TYPES).default("single"),
        is_required: z.boolean().default(false),
        is_active: z.boolean().default(true),
    });

    private static readonly groupUpdateSchema = this.groupCreateSchema.partial();

    private static readonly optionCreateSchema = z.object({
        name: z.string().trim().min(1, "Nama pilihan wajib diisi").max(50, "Nama maksimal 50 karakter"),
        price: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
        price_mode: z.enum(ADDON_PRICE_MODES).default("per_unit"),
        is_default: z.boolean().default(false),
        is_active: z.boolean().default(true),
    });

    private static readonly optionUpdateSchema = this.optionCreateSchema.partial();

    static validateGroupCreate(input: unknown): addonGroupCreateType {
        return this.parse(this.groupCreateSchema, input);
    }

    static validateGroupUpdate(input: unknown): addonGroupUpdateType {
        return this.parse(this.groupUpdateSchema, input);
    }

    static validateOptionCreate(groupId: number, input: unknown): addonOptionCreateType {
        return { ...this.parse(this.optionCreateSchema, input), group_id: groupId };
    }

    static validateOptionUpdate(input: unknown): addonOptionUpdateType {
        return this.parse(this.optionUpdateSchema, input);
    }

    static validateTargetType(value: string): "service" | "product" {
        if (value !== "service" && value !== "product") {
            throw AppError.validation({ target: "Target add-on tidak valid" });
        }
        return value;
    }

    static validateGroupIds(input: unknown): number[] {
        const result = z.object({
            group_ids: z.array(z.coerce.number().int().positive()).default([]),
        }).safeParse(input);
        if (!result.success) throw AppError.fromZod(result.error);
        return [...new Set(result.data.group_ids)];
    }

    private static parse<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
        const result = schema.safeParse(input);
        if (!result.success) {
            throw AppError.fromZod(result.error);
        }
        return result.data;
    }
}
