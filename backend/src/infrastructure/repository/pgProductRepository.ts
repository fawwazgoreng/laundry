import type { productRepository } from "../../domain/repositories/productRepository";
import type { productListOptions } from "../../domain/repositories/productRepository";
import type { productCreateType, productType, productUpdateType } from "../../domain/types/productType";
import type { serviceAddonGroupType } from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";
import { flag, isFlag, numeric, varchar } from "../prisma/scalars";
import type { Models } from "../database/generated/contract";
import { toAddonGroup, type AddonGroupRow } from "./addonRowMapper";
import { money } from "../../lib/money";

type ProductRow = Pick<Models.Products, "id" | "name" | "category" | "price" | "size" | "stock" | "is_active" | "image"> & {
    addonGroups?: Array<{ group: AddonGroupRow | null }>;
};

function toProductType(row: ProductRow, activeOnly = false): productType {
    return {
        id: row.id,
        name: row.name,
        category: row.category as productType["category"],
        price: money(row.price),
        size: row.size,
        stock: row.stock,
        is_active: isFlag(row.is_active),
        image: row.image,
        addon_groups: (row.addonGroups ?? [])
            .map((link) => (link.group ? toAddonGroup(link.group, activeOnly) : null))
            .filter((group): group is serviceAddonGroupType => group !== null),
    };
}

const productQuery = () =>
    prisma.orm.Products
        .include("addonGroups", (link) =>
            link.include("group", (group) => group.include("options")),
        );
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

        const rowsQuery = productQuery().where((p, { fns }) => {
            const conditions = [p.is_active.eq(1)];
            if (inStockOnly) conditions.push(p.stock.gt(0));
            if (category !== "all") conditions.push(p.category.eq(varchar(category)));
            if (search) conditions.push(p.name.like(`%${search}%`));
            return fns.and(...conditions);
        });

        const ordered = (() => {
            switch (sort) {
                case "terbaru": return rowsQuery.orderBy((p) => p.id.desc());
                case "terlama": return rowsQuery.orderBy((p) => p.id.asc());
                case "termahal": return rowsQuery.orderBy((p) => p.price.desc());
                case "termurah": return rowsQuery.orderBy((p) => p.price.asc());
                default: return rowsQuery.orderBy((p) => p.id.desc());
            }
        })();

        const [rows, countRows] = await Promise.all([
            ordered
                .offset((page - 1) * perPage).limit(perPage).all(),
            prisma.query(
                prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Products\`
                    WHERE \`is_active\` = 1
                      AND (${inStockOnly ? 1 : 0} = 0 OR \`stock\` > 0)
                      AND (${category === "all" ? 1 : 0} = 0 OR \`category\` = ${category})
                      AND (${search ? 1 : 0} = 0 OR \`name\` LIKE ${`%${search ?? ""}%`})`
                    .returnsRow({ n: "mysql/bigint@1" })
                    .build(),
            ),
        ]);

        return { data: rows.map((row) => toProductType(row, true)), count: Number(countRows[0]?.n ?? 0n) };
    }

    async findById(id: number): Promise<productType | null> {
        const row = await productQuery().where({ id }).first();
        return row ? toProductType(row, true) : null;
    }

    async create(data: productCreateType): Promise<productType> {
        const row = await prisma.orm.Products.create({
            name: varchar(data.name),
            category: varchar(data.category),
            price: numeric(data.price),
            size: varchar(data.size),
            stock: data.stock,
            is_active: flag(data.is_active),
            image: "",
        });
        return toProductType(row);
    }

    async update(id: number, data: productUpdateType): Promise<productType | null> {
        const existing = await prisma.orm.Products.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.Products.where({ id }).update({
            ...(data.name !== undefined ? { name: varchar(data.name) } : {}),
            ...(data.category !== undefined ? { category: varchar(data.category) } : {}),
            ...(data.price !== undefined ? { price: numeric(data.price) } : {}),
            ...(data.size !== undefined ? { size: varchar(data.size) } : {}),
            ...(data.stock !== undefined ? { stock: data.stock } : {}),
            ...(data.is_active !== undefined ? { is_active: flag(data.is_active) } : {}),
        });
        return row ? toProductType({ ...row, addonGroups: [] }) : null;
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.orm.Products.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.Products.where({ id }).update({ is_active: 0 });
        return true;
    }

    async updateImage(id: number, image: string): Promise<productType | null> {
        const existing = await prisma.orm.Products.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.Products.where({ id }).update({ image });
        return row ? toProductType({ ...row, addonGroups: [] }) : null;
    }

    async decrementStock(id: number, qty: number): Promise<productType | null> {
        const existing = await prisma.orm.Products.where({ id }).first();
        if (!existing) return null;
        const newStock = Math.max(0, existing.stock - qty);
        const row = await prisma.orm.Products.where({ id }).update({ stock: newStock });
        return row ? toProductType({ ...row, addonGroups: [] }) : null;
    }
}
