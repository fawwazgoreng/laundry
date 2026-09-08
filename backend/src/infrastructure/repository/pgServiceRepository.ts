import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type { serviceCreateType, serviceType, serviceUpdateType } from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";

type ServiceRow = {
    id: number
    name: string
    unit: string
    price_per_unit: unknown
    description: string
    estimated_duration_hours: number
    is_active: boolean
};

function toServiceType(row: ServiceRow): serviceType {
    return {
        id: row.id,
        name: row.name,
        unit: row.unit,
        price_per_unit: Number(row.price_per_unit),
        description: row.description,
        estimated_duration_hours: row.estimated_duration_hours,
        is_active: row.is_active,
    };
}

export class pgServiceRepository implements serviceRepository {
    async list(activeOnly = true): Promise<serviceType[]> {
        const rows = await prisma.laundry_services.findMany({
            where: activeOnly ? { is_active: true } : {},
            orderBy: { id: "asc" },
        });
        return rows.map(toServiceType);
    }

    async findById(id: number): Promise<serviceType | null> {
        const row = await prisma.laundry_services.findUnique({ where: { id } });
        return row ? toServiceType(row) : null;
    }

    async create(data: serviceCreateType): Promise<serviceType> {
        const row = await prisma.laundry_services.create({
            data: {
                name: data.name,
                unit: data.unit,
                price_per_unit: data.price_per_unit,
                description: data.description,
                estimated_duration_hours: data.estimated_duration_hours,
                is_active: data.is_active,
            },
        });
        return toServiceType(row);
    }

    async update(id: number, data: serviceUpdateType): Promise<serviceType | null> {
        const existing = await prisma.laundry_services.findUnique({ where: { id } });
        if (!existing) return null;
        const row = await prisma.laundry_services.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.unit !== undefined ? { unit: data.unit } : {}),
                ...(data.price_per_unit !== undefined ? { price_per_unit: data.price_per_unit } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.estimated_duration_hours !== undefined ? { estimated_duration_hours: data.estimated_duration_hours } : {}),
                ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
            },
        });
        return toServiceType(row);
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.laundry_services.findUnique({ where: { id } });
        if (!existing) return false;
        await prisma.laundry_services.update({ where: { id }, data: { is_active: false } });
        return true;
    }
}