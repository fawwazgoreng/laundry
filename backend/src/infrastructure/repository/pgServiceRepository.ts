import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type {
    serviceAddonGroupType,
    serviceCreateType,
    serviceType,
    serviceUpdateType,
} from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";
import { flag, isFlag, numeric, varchar } from "../prisma/scalars";
import type { Models } from "../database/generated/contract";
import { toAddonGroup, type AddonGroupRow } from "./addonRowMapper";
import { money } from "../../lib/money";

type ServiceRow = Pick<Models.Laundry_services, "id" | "name" | "unit" | "price_per_unit" | "description" | "estimated_duration_hours" | "is_active"> & {
    addonGroups: Array<{ group: AddonGroupRow | null }>;
};

function toServiceType(row: ServiceRow, activeOnly = false): serviceType {
    return {
        id: row.id,
        name: row.name,
        unit: row.unit,
        price_per_unit: money(row.price_per_unit),
        description: row.description,
        estimated_duration_hours: row.estimated_duration_hours,
        is_active: isFlag(row.is_active),
        addon_groups: row.addonGroups
            .map((link) => (link.group ? toAddonGroup(link.group, activeOnly) : null))
            .filter((group): group is serviceAddonGroupType => group !== null)
    };
}

const serviceQuery = () =>
    prisma.orm.Laundry_services
        .include("addonGroups", (link) =>
            link.include("group", (group) => group.include("options")),
        );

export class pgServiceRepository implements serviceRepository {
    async list(activeOnly = true): Promise<serviceType[]> {
        const rows = await serviceQuery()
            .where(activeOnly ? { is_active: 1 } : {})
            .orderBy((s) => s.id.asc())
            .all();
        return rows.map((row) => toServiceType(row, activeOnly));
    }

    async findById(id: number): Promise<serviceType | null> {
        const row = await serviceQuery().where({ id }).first();
        return row ? toServiceType(row, false) : null;
    }

    async create(data: serviceCreateType): Promise<serviceType> {
        const row = await prisma.orm.Laundry_services.create({
            name: varchar(data.name),
            unit: varchar(data.unit),
            price_per_unit: numeric(data.price_per_unit),
            description: data.description,
            estimated_duration_hours: data.estimated_duration_hours,
            is_active: flag(data.is_active),
        });
        return {
            ...toServiceType({ ...row, addonGroups: [] }),
            addon_groups: [],
        };
    }

    async update(id: number, data: serviceUpdateType): Promise<serviceType | null> {
        const existing = await prisma.orm.Laundry_services.where({ id }).first();
        if (!existing) return null;
        await prisma.orm.Laundry_services.where({ id }).update({
            ...(data.name !== undefined ? { name: varchar(data.name) } : {}),
            ...(data.unit !== undefined ? { unit: varchar(data.unit) } : {}),
            ...(data.price_per_unit !== undefined ? { price_per_unit: numeric(data.price_per_unit) } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.estimated_duration_hours !== undefined ? { estimated_duration_hours: data.estimated_duration_hours } : {}),
            ...(data.is_active !== undefined ? { is_active: flag(data.is_active) } : {}),
        });
        const row = await serviceQuery().where({ id }).first();
        return row ? toServiceType(row, false) : null;
    }

    async remove(id: number): Promise<boolean> {
        const existing = await prisma.orm.Laundry_services.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.Laundry_services.where({ id }).update({ is_active: 0 });
        return true;
    }
}
