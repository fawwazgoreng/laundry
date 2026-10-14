import type { productRepository } from "../../domain/repositories/productRepository";
import type { productListOptions } from "../../domain/repositories/productRepository";
import type { productCreateType, productType, productUpdateType } from "../../domain/types/productType";
import { prisma } from "../prisma/prisma";

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

        const where = {
            is_active: true,
            ...(inStockOnly ? { stock: { gt: 0 } } : {}),
            ...(category !== "all" ? { category } : {}),
            ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        };

        const orderBy = (() => {
            switch (sort) {
                case "terbaru": return [{ id: "desc" as const }];
                case "terlama": return [{ id: "asc" as const }];
                case "termahal": return [{ price: "desc" as const }];
                case "termurah": return [{ price: "asc" as const }];
                default: return [{ id: "desc" as const }];
            }
        })();

        const [rows, count] = await Promise.all([
            prisma.products.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage }),
            prisma.products.count({ where }),
        ]);

        return { data: rows.map(toProductType), count };
    }

    async findById(id: number): Promise<productType | null> {
        const row = await prisma.products.findUnique({ where: { id } });
        return row ? toProductType(row) : null;
    }

    async create(data: productCreateType): Promise<productType> {
        const row = await prisma.products.create({
            data: {
                name: data.name,
                category: data.category,
                price: data.price,
                size: data.size,
                stock: data.stock,
                is_active: data.is_active,
                image: "",
            },
        });
        return toProductType(row);
    }

    async update(id: number, data: productUpdateType): Promise<productType | null> {
        const existing = await prisma.products.findUnique({ where: { id } });
        if (!existing) return null;
        const row = await prisma.products.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.category !== undefined ? { category: data.category } : {}),
                ...(data.price !== undefined ? { price: data.price } : {}),
                ...(data.size !== undefined ? { size: data.size } : {}),
                ...(data.stock !== undefined ? { stock: data.stock } : {}),
                ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
            },
        });
        return toProductType(row);
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.products.findUnique({ where: { id } });
        if (!existing) return false;
        await prisma.products.update({ where: { id }, data: { is_active: false } });
        return true;
    }

    async updateImage(id: number, image: string): Promise<productType | null> {
        const existing = await prisma.products.findUnique({ where: { id } });
        if (!existing) return null;
        const row = await prisma.products.update({ where: { id }, data: { image } });
        return toProductType(row);
    }

    async decrementStock(id: number, qty: number): Promise<productType | null> {
        const existing = await prisma.products.findUnique({ where: { id } });
        if (!existing) return null;
        const newStock = Math.max(0, existing.stock - qty);
        const row = await prisma.products.update({ where: { id }, data: { stock: newStock } });
        return toProductType(row);
    }
}