import type { outletRepository } from "../../domain/repositories/outletRepository";
import type { outletType, outletUpdateType } from "../../domain/types/outletType";
import { prisma } from "../prisma/prisma";

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
        const rows = await prisma.outlets.findMany({ orderBy: { id: "asc" } });
        return rows.map(toOutletType);
    }

    async findById(id: number): Promise<outletType | null> {
        const row = await prisma.outlets.findUnique({ where: { id } });
        return row ? toOutletType(row) : null;
    }

    async findFirst(): Promise<outletType | null> {
        const row = await prisma.outlets.findFirst({ orderBy: { id: "asc" } });
        return row ? toOutletType(row) : null;
    }

    async update(id: number, data: outletUpdateType): Promise<outletType | null> {
        const existing = await prisma.outlets.findUnique({ where: { id } });
        if (!existing) return null;
        const row = await prisma.outlets.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
                ...(data.address_text !== undefined ? { address_text: data.address_text } : {}),
                ...(data.max_coverage_km !== undefined ? { max_coverage_km: data.max_coverage_km } : {}),
                ...(data.min_order_amount !== undefined ? { min_order_amount: data.min_order_amount } : {}),
                ...(data.weekly_hours !== undefined ? { weekly_hours: data.weekly_hours } : {}),
                ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
                ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
            
            },
        });
        return toOutletType(row);
    }
}