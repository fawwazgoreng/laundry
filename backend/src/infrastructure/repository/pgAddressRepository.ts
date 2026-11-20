import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { addressCreateType, addressType, addressUpdateType } from "../../domain/types/addressType";
import { prisma } from "../prisma/prisma";
import { flag, isFlag, numeric, varchar } from "../prisma/scalars";

type AddressRow = {
    id: number
    label: string
    address_text: string
    latitude: string
    longitude: string
    is_primary: number
    user_id: string
};

function toAddressType(row: AddressRow): addressType {
    return {
        id: row.id,
        label: row.label,
        address_text: row.address_text,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        is_primary: isFlag(row.is_primary),
        user_id: row.user_id,
    };
}

export class pgAddressRepository implements addressRepository {
    async listByUser(userId: string): Promise<addressType[]> {
        const rows = await prisma.orm.User_address
            .where({ user_id: userId })
            .orderBy((r) => r.id.desc())
            .all();
        rows.sort((a, b) => b.is_primary - a.is_primary);
        return rows.map(toAddressType);
    }

    async findById(userId: string, id: number): Promise<addressType | null> {
        const row = await prisma.orm.User_address.where({ id, user_id: userId }).first();
        return row ? toAddressType(row) : null;
    }

    async create(userId: string, data: addressCreateType, isPrimary = false): Promise<addressType> {
        const row = await prisma.orm.User_address.create({
            label: varchar(data.label),
            address_text: data.address_text,
            latitude: numeric(data.latitude),
            longitude: numeric(data.longitude),
            is_primary: flag(isPrimary),
            user_id: userId,
        });
        return toAddressType(row);
    }

    async update(userId: string, id: number, data: addressUpdateType): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        const row = await prisma.orm.User_address.where({ id }).update({
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
        await prisma.orm.User_address.where({ id }).delete();
        return true;
    }

    async setPrimary(userId: string, id: number): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        await prisma.orm.User_address
            .where({ user_id: userId, is_primary: 1 })
            .updateAll({ is_primary: 0 });
        const row = await prisma.orm.User_address.where({ id }).update({ is_primary: 1 });
        return row ? toAddressType(row) : null;
    }

    async clearPrimary(userId: string, exceptId: number): Promise<void> {
        await prisma.orm.User_address
            .where((a, { fns }) => fns.and(a.user_id.eq(userId), a.is_primary.eq(1), a.id.neq(exceptId)))
            .updateAll({ is_primary: 0 });
    }

    async countByUser(userId: string): Promise<number> {
        const [row] = await prisma.query(
            prisma.raw.sql`SELECT COUNT(*) AS n FROM \`User_address\` WHERE \`user_id\` = ${userId}`
                .returnsRow({ n: "mysql/bigint@1" })
                .build(),
        );
        return Number(row?.n ?? 0n);
    }
}
