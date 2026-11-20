import type { addonRepository } from "../../domain/repositories/addonRepository";
import type {
    addonGroupCreateType,
    addonGroupUpdateType,
    addonOptionCreateType,
    addonOptionUpdateType,
    addonTargetType,
} from "../../domain/types/addonType";
import type { serviceAddonGroupType } from "../../domain/types/serviceType";
import { prisma } from "../prisma/prisma";
import { flag, numeric, varchar } from "../prisma/scalars";
import { toAddonGroup } from "./addonRowMapper";

const groupQuery = () =>
    prisma.orm.Service_addon_groups.include("options");

export class pgAddonRepository implements addonRepository {
    async listGroups(includeInactive: boolean): Promise<serviceAddonGroupType[]> {
        const rows = await groupQuery().all();
        return rows
            .map((row) => toAddonGroup(row, !includeInactive))
            .filter((group): group is serviceAddonGroupType => group !== null)
    }

    async findGroupById(id: number): Promise<serviceAddonGroupType | null> {
        const row = await groupQuery().where({ id }).first();
        return row ? toAddonGroup(row, false) : null;
    }

    async createGroup(data: addonGroupCreateType): Promise<serviceAddonGroupType> {
        const row = await prisma.orm.Service_addon_groups.create({
            code: varchar<30>(data.code),
            name: varchar<50>(data.name),
            selection_type: varchar<20>(data.selection_type),
            is_required: flag(data.is_required),
            is_active: flag(data.is_active),
        });
        return {
            ...toAddonGroup({ ...row, options: [] }, false)!,
        };
    }

    async updateGroup(id: number, data: addonGroupUpdateType): Promise<serviceAddonGroupType | null> {
        const existing = await prisma.orm.Service_addon_groups.where({ id }).first();
        if (!existing) return null;
        await prisma.orm.Service_addon_groups.where({ id }).update({
            ...(data.code !== undefined ? { code: varchar<30>(data.code) } : {}),
            ...(data.name !== undefined ? { name: varchar<50>(data.name) } : {}),
            ...(data.selection_type !== undefined ? { selection_type: varchar<20>(data.selection_type) } : {}),
            ...(data.is_required !== undefined ? { is_required: flag(data.is_required) } : {}),
            ...(data.is_active !== undefined ? { is_active: flag(data.is_active) } : {}),
        });
        return this.findGroupById(id);
    }

    async removeGroup(id: number): Promise<boolean> {
        const existing = await prisma.orm.Service_addon_groups.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.Service_addon_groups.where({id}).delete();
        return true;
    }

    async createOption(data: addonOptionCreateType): Promise<serviceAddonGroupType | null> {
        const group = await prisma.orm.Service_addon_groups.where({ id: data.group_id }).first();
        if (!group) return null;
        await prisma.orm.Service_addon_options.create({
            group_id: data.group_id,
            name: varchar<50>(data.name),
            price: numeric<12, 2>(data.price),
            price_mode: varchar<20>(data.price_mode),
            is_default: flag(data.is_default),
            is_active: flag(data.is_active),
        });
        return this.findGroupById(data.group_id);
    }

    async updateOption(id: number, data: addonOptionUpdateType): Promise<serviceAddonGroupType | null> {
        const existing = await prisma.orm.Service_addon_options.where({ id }).first();
        if (!existing) return null;
        await prisma.orm.Service_addon_options.where({ id }).update({
            ...(data.name !== undefined ? { name: varchar<50>(data.name) } : {}),
            ...(data.price !== undefined ? { price: numeric<12, 2>(data.price) } : {}),
            ...(data.price_mode !== undefined ? { price_mode: varchar<20>(data.price_mode) } : {}),
            ...(data.is_default !== undefined ? { is_default: flag(data.is_default) } : {}),
            ...(data.is_active !== undefined ? { is_active: flag(data.is_active) } : {}),
        });
        return this.findGroupById(existing.group_id);
    }

    async removeOption(id: number): Promise<boolean> {
        const existing = await prisma.orm.Service_addon_options.where({ id }).first();
        if (!existing) return false;
        await prisma.orm.Service_addon_options.where({ id }).delete();
        return true;
    }

    async listTargetGroupIds(targetType: addonTargetType, targetId: number): Promise<number[]> {
        if (targetType === "service") {
            const rows = await prisma.orm.Laundry_service_addon_groups
                .where({ service_id: targetId })
                .all();
            return rows.map((row) => row.group_id).sort((a, b) => a - b);
        }
        const rows = await prisma.orm.Product_addon_groups
            .where({ product_id: targetId })
            .all();
        return rows.map((row) => row.group_id).sort((a, b) => a - b);
    }

    async setTargetGroups(targetType: addonTargetType, targetId: number, groupIds: number[]): Promise<void> {
        await prisma.transaction(async (tx) => {
            if (targetType === "service") {
                await tx.orm.Laundry_service_addon_groups
                    .where({ service_id: targetId })
                    .deleteAll();
                for (const groupId of groupIds) {
                    await tx.orm.Laundry_service_addon_groups.create({
                        service_id: targetId,
                        group_id: groupId,
                    });
                }
                return;
            }
            await tx.orm.Product_addon_groups
                .where({ product_id: targetId })
                .deleteAll();
            for (const groupId of groupIds) {
                await tx.orm.Product_addon_groups.create({
                    product_id: targetId,
                    group_id: groupId,
                });
            }
        });
    }
}
