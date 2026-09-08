import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { addressCreateType, addressType, addressUpdateType } from "../../domain/types/addressType";
import { prisma } from "../prisma/prisma";

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
        const rows = await prisma.user_address.findMany({
            where: { user_id: userId },
            orderBy: [{ is_primary: "desc" }, { id: "desc" }],
        });
        return rows.map(toAddressType);
    }

    async findById(userId: string, id: number): Promise<addressType | null> {
        const row = await prisma.user_address.findFirst({ where: { id, user_id: userId } });
        return row ? toAddressType(row) : null;
    }

    async create(userId: string, data: addressCreateType, isPrimary = false): Promise<addressType> {
        const row = await prisma.user_address.create({
            data: {
                label: data.label,
                address_text: data.address_text,
                latitude: data.latitude,
                longitude: data.longitude,
                is_primary: isPrimary,
                user_id: userId,
            },
        });
        return toAddressType(row);
    }

    async update(userId: string, id: number, data: addressUpdateType): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        const row = await prisma.user_address.update({
            where: { id },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.address_text !== undefined ? { address_text: data.address_text } : {}),
                ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
                ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
            },
        });
        return toAddressType(row);
    }

    async remove(userId: string, id: number): Promise<boolean> {
        const existing = await this.findById(userId, id);
        if (!existing) return false;
        await prisma.user_address.delete({ where: { id } });
        return true;
    }

    async setPrimary(userId: string, id: number): Promise<addressType | null> {
        const existing = await this.findById(userId, id);
        if (!existing) return null;
        await prisma.user_address.updateMany({
            where: { user_id: userId, is_primary: true },
            data: { is_primary: false },
        });
        return prisma.user_address
            .update({ where: { id }, data: { is_primary: true } })
            .then(toAddressType);
    }

    async clearPrimary(userId: string, exceptId: number): Promise<void> {
        await prisma.user_address.updateMany({
            where: { user_id: userId, is_primary: true, id: { not: exceptId } },
            data: { is_primary: false },
        });
    }

    async countByUser(userId: string): Promise<number> {
        return prisma.user_address.count({ where: { user_id: userId } });
    }
}