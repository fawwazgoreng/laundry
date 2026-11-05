import { z } from "zod";
import { AppError } from "../../helper/errorHandling/appError";
import type { productCategory, productCreateType, productUpdateType } from "../types/productType";

const categories = ["Detergen", "Softener", "Pewangi", "Pemutih", "Paket Hemat"] as const;

export class productEntity {
    private static readonly createSchema = z.object({
        name: z.string().min(1, "Name is required").max(30, "Name max 30 characters"),
        category: z.enum(categories, { message: "Invalid category" }),
        price: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
        size: z.string().max(10, "Size max 10 characters").default("pcs"),
        stock: z.coerce.number().int().nonnegative("Stok tidak boleh negatif").default(0),
        is_active: z.boolean().default(true),
    });

    private static readonly updateSchema = this.createSchema.partial();

    static validateCreate(input: unknown): productCreateType {
        return this.parse(this.createSchema, input);
    }

    static validateUpdate(input: unknown): productUpdateType {
        return this.parse(this.updateSchema, input);
    }

    static isValidCategory(category: string): category is productCategory {
        return (categories as readonly string[]).includes(category);
    }

    private static parse<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
        const result = schema.safeParse(input);
        if (!result.success) {
            throw AppError.fromZod(result.error);
        }
        return result.data;
    }
}