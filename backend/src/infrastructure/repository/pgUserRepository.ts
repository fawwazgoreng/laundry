import type { userRepository } from "../../domain/repositories/userRepository";
import type { registerType, userRole, userType, userWithPassword } from "../../domain/types/userType";
import { prisma } from "../prisma/prisma";

type UserRow = {
    id: string
    username: string
    email: string
    role: string
    phone: string
    is_verified: boolean
};

function toUserType(row: UserRow): userType {
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role as userRole,
        phone: row.phone,
        is_verified: row.is_verified,
    };
}

export class pgUserRepository implements userRepository {
    async create(data: registerType): Promise<userType> {
        const user = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                phone: data.phone,
                password: data.password,
                role: "user",
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                is_verified: true,
            },
        });
        return toUserType(user);
    }

    async findByEmail(email: string): Promise<userWithPassword | null> {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                is_verified: true,
                password: true,
            },
        });
        if (!user) return null;
        return { ...toUserType(user), password: user.password };
    }

    async findById(id: string): Promise<userType | null> {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                is_verified: true,
            },
        });
        return user ? toUserType(user) : null;
    }

    async updateUsername(id: string, username: string): Promise<userType> {
        const user = await prisma.user.update({
            where: { id },
            data: { username },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                is_verified: true,
            },
        });
        return toUserType(user);
    }

    async updateProfile(id: string, data: { username?: string; phone?: string }): Promise<userType | null> {
        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return null;
        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(data.username !== undefined ? { username: data.username } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                is_verified: true,
            },
        });
        return toUserType(user);
    }
}