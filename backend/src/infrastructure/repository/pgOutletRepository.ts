import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { outletType, outletUpdateType } from "../../domain/types/outletType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";

type OutletRow = {
    id: number
    name: string
    phone: string | null
    address_text: string | null
    latitude: unknown
    longitude: unknown
    max_coverage_km: unknown
    min_order_amount: unknown
    weekly_hours: string | null
};

function toOutletType(row: OutletRow): outletType {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        address_text: row.address_text,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        max_coverage_km: Number(row.max_coverage_km),
        min_order_amount: Number(row.min_order_amount),
        weekly_hours: row.weekly_hours,
    };
}

export class pgOutletRepository implements outletRepository {
    async list(): Promise<outletType[]> {
        const rows = await prisma.orm.public.Outlets.orderBy((o) => o.id.asc()).all();
        return rows.map(toOutletType);
    }

    async findById(id: number): Promise<outletType | null> {
        const row = await prisma.orm.public.Outlets.where({ id }).first();
        return row ? toOutletType(row) : null;
    }

    async findFirst(): Promise<outletType | null> {
        const row = await prisma.orm.public.Outlets.orderBy((o) => o.id.asc()).first();
        return row ? toOutletType(row) : null;
    }

    async update(id: number, data: outletUpdateType): Promise<outletType | null> {
        const existing = await prisma.orm.public.Outlets.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.public.Outlets.where({ id }).update({
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.phone !== undefined ? { phone: varchar(data.phone) } : {}),
            ...(data.address_text !== undefined ? { address_text: data.address_text } : {}),
            ...(data.max_coverage_km !== undefined ? { max_coverage_km: numeric(data.max_coverage_km) } : {}),
            ...(data.min_order_amount !== undefined ? { min_order_amount: numeric(data.min_order_amount) } : {}),
            ...(data.weekly_hours !== undefined ? { weekly_hours: data.weekly_hours } : {}),
            ...(data.latitude !== undefined ? { latitude: numeric(data.latitude) } : {}),
            ...(data.longitude !== undefined ? { longitude: numeric(data.longitude) } : {}),
        });
        return row ? toOutletType(row) : null;
    }
}