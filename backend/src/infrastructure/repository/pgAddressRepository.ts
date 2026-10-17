import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { addressCreateType, addressType, addressUpdateType } from "../../domain/types/addressType";
import { prisma } from "../prisma/prisma";
import { numeric, varchar } from "../prisma/scalars";

type AddressRow = {
    id: number
    label: string
    address_text: string
    latitude: unknown
    longitude: unknown
    is_primary: boolean
    user_id: string
};

function toAddressType(row: AddressRow): addressType {
    return {
        id: row.id,
        label: row.label,
        address_text: row.address_text,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        is_primary: row.is_primary,
        user_id: row.user_id,
    };
}

export class pgAddressRepository implements addressRepository {
    async listByUser(userId: string): Promise<addressType[]> {
        const rows = await prisma.orm.public.User_address
            .where({ user_id: userId })
            .orderBy((r) => r.id.desc())
            .all();
        rows.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
        return rows.map(toAddressType);
    }

    async findById(userId: string, id: number): Promise<addressType | null> {
        const row = await prisma.orm.public.User_address.where({ id, user_id: userId }).first();
        return row ? toAddressType(row) : null;
    }

    async create(userId: string, data: addressCreateType, isPrimary = false): Promise<addressType> {
        const row = await prisma.orm.public.User_address.create({
            label: varchar(data.label),
            address_text: data.address_text,
            latitude: numeric(data.latitude),
            longitude: numeric(data.longitude),
            is_primary: isPrimary,
            user_id: userId,
        });
        return toAddressType(row);
    }

    async update(userId: string, id: number, data: addressUpdateType): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        const row = await prisma.orm.public.User_address.where({ id }).update({
            ...(data.label !== undefined ? { label: varchar(data.label) } : {}),
            ...(data.address_text !== undefined ? { address_text: data.address_text } : {}),
            ...(data.latitude !== undefined ? { latitude: numeric(data.latitude) } : {}),
            ...(data.longitude !== undefined ? { longitude: numeric(data.longitude) } : {}),
        });
        return row ? toAddressType(row) : null;
    }

    async remove(userId: string, id: number): Promise<boolean> {
        const existing = await this.findById(userId, id);
        if (!existing) return false;
        await prisma.orm.public.User_address.where({ id }).delete();
        return true;
    }

    async setPrimary(userId: string, id: number): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        await prisma.orm.public.User_address
            .where({ user_id: userId, is_primary: true })
            .updateAll({ is_primary: false });
        const row = await prisma.orm.public.User_address.where({ id }).update({ is_primary: true });
        return row ? toAddressType(row) : null;
    }

    async clearPrimary(userId: string, exceptId: number): Promise<void> {
        await prisma.orm.public.User_address
            .where((a, { fns }) => fns.and(a.user_id.eq(userId), a.is_primary.eq(true), a.id.neq(exceptId)))
            .updateAll({ is_primary: false });
    }

    async countByUser(userId: string): Promise<number> {
        const { count } = await prisma.orm.public.User_address
            .where({ user_id: userId })
            .aggregate((agg) => ({ count: agg.count() }));
        return count;
    }
}
