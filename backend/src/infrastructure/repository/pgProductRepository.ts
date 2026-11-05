import type { productRepository } from "../../domain/repositories/productRepository";
import type { productListOptions } from "../../domain/repositories/productRepository";
import type { productCreateType, productType, productUpdateType } from "../../domain/types/productType";
import type { serviceAddonGroupType } from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";
import { toAddonGroup, type AddonGroupRow } from "./addonRowMapper";

type ProductRow = {
    id: number
    name: string
    category: string
    price: unknown
    size: string
    stock: number
    is_active: boolean
    image: string
};

function toProductType(row: ProductRow): productType {
    return {
        id: row.id,
        name: row.name,
        category: row.category as productType["category"],
        price: Number(row.price),
        size: row.size,
        stock: row.stock,
        is_active: row.is_active,
        image: row.image,
    };
}
export class pgProductRepository implements productRepository {
    async list(opts: productListOptions = {}): Promise<{ data: productType[]; count: number }> {
        const {
            category = "all",
            search,
            sort = "terbaru",
            page = 1,
            perPage = 12,
            inStockOnly = false,
        } = opts;

        const base = prisma.orm.public.Products.where((p, { fns }) => {
            const conditions = [p.is_active.eq(true)];
            if (inStockOnly) conditions.push(p.stock.gt(0));
            if (category !== "all") conditions.push(p.category.eq(varchar(category)));
            if (search) conditions.push(p.name.ilike(`%${search}%`));
            return fns.and(...conditions);
        });

        const ordered = (() => {
            switch (sort) {
                case "terbaru": return base.orderBy((p) => p.id.desc());
                case "terlama": return base.orderBy((p) => p.id.asc());
                case "termahal": return base.orderBy((p) => p.price.desc());
                case "termurah": return base.orderBy((p) => p.price.asc());
                default: return base.orderBy((p) => p.id.desc());
            }
        })();

        const [rows, countAgg] = await Promise.all([
            ordered
                .offset((page - 1) * perPage).limit(perPage).all(),
            base.aggregate((agg) => ({ count: agg.count() })),
        ]);

        return { data: rows.map((row) => toProductType(row)), count: countAgg.count };
    }

    async findById(id: number): Promise<productType | null> {
        const row = await prisma.orm.public.Products.where({ id }).first();
        return row ? toProductType(row) : null;
    }

    async create(data: productCreateType): Promise<productType> {
        const row = await prisma.orm.public.Products.create({
            name: varchar(data.name),
            category: varchar(data.category),
            price: numeric(data.price),
            size: varchar(data.size),
            stock: data.stock,
            is_active: data.is_active,
            image: "",
        });
        return toProductType(row);
    }

    async update(id: number, data: productUpdateType): Promise<productType | null> {
        const existing = await prisma.orm.public.Products.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.public.Products.where({ id }).update({
            ...(data.name !== undefined ? { name: varchar(data.name) } : {}),
            ...(data.category !== undefined ? { category: varchar(data.category) } : {}),
            ...(data.price !== undefined ? { price: numeric(data.price) } : {}),
            ...(data.size !== undefined ? { size: varchar(data.size) } : {}),
            ...(data.stock !== undefined ? { stock: data.stock } : {}),
            ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        });
        return row ? toProductType(row) : null;
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.orm.public.Products.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.public.Products.where({ id }).update({ is_active: false });
        return true;
    }

    async updateImage(id: number, image: string): Promise<productType | null> {
        const existing = await prisma.orm.public.Products.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.public.Products.where({ id }).update({ image });
        return row ? toProductType(row) : null;
    }

    async decrementStock(id: number, qty: number): Promise<productType | null> {
        const existing = await prisma.orm.public.Products.where({ id }).first();
        if (!existing) return null;
        const newStock = Math.max(0, existing.stock - qty);
        const row = await prisma.orm.public.Products.where({ id }).update({ stock: newStock });
        return row ? toProductType(row) : null;
    }
}