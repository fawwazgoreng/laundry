import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type { serviceCreateType, serviceType, serviceUpdateType } from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";

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
        const rows = await prisma.orm.public.Laundry_services
            .where(activeOnly ? { is_active: true } : {})
            .orderBy((s) => s.id.asc())
            .all();
        return rows.map(toServiceType);
    }

    async findById(id: number): Promise<serviceType | null> {
        const row = await prisma.orm.public.Laundry_services.where({ id }).first();
        return row ? toServiceType(row) : null;
    }

    async create(data: serviceCreateType): Promise<serviceType> {
        const row = await prisma.orm.public.Laundry_services.create({
            name: varchar(data.name),
            unit: varchar(data.unit),
            price_per_unit: numeric(data.price_per_unit),
            description: data.description,
            estimated_duration_hours: data.estimated_duration_hours,
            is_active: data.is_active,
        });
        return toServiceType(row);
    }

    async update(id: number, data: serviceUpdateType): Promise<serviceType | null> {
        const existing = await prisma.orm.public.Laundry_services.where({ id }).first();
        if (!existing) return null;
        const row = await prisma.orm.public.Laundry_services.where({ id }).update({
            ...(data.name !== undefined ? { name: varchar(data.name) } : {}),
            ...(data.unit !== undefined ? { unit: varchar(data.unit) } : {}),
            ...(data.price_per_unit !== undefined ? { price_per_unit: numeric(data.price_per_unit) } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.estimated_duration_hours !== undefined ? { estimated_duration_hours: data.estimated_duration_hours } : {}),
            ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        });
        return row ? toServiceType(row) : null;
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.orm.public.Laundry_services.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.public.Laundry_services.where({ id }).update({ is_active: false });
        return true;
    }
}