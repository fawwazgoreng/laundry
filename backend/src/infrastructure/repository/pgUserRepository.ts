import type { userRepository } from "../../domain/repositories/userRepository";
import type { registerType, userRole, userType, userWithPassword } from "../../domain/types/userType";
import { prisma } from "../prisma/prisma";
import { varchar } from "../prisma/scalars";

type UserRow = {
    id: string
    username: string
    email: string
    role: string
    phone: string
    is_verified: boolean
    created_at: Temporal.Instant
};

function toUserType(row: UserRow): userType {
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role as userRole,
        phone: row.phone,
        is_verified: row.is_verified,
        created_at: new Date(row.created_at.epochMilliseconds).toISOString(),
    };
}

export class pgUserRepository implements userRepository {
    async create(data: registerType): Promise<userType> {
        const user = await prisma.orm.public.User.create({
            username: varchar(data.username),
            email: data.email,
            phone: varchar(data.phone),
            password: data.password,
            role: varchar("user"),
        });
        return toUserType(user);
    }

    async findByEmail(email: string): Promise<userWithPassword | null> {
        const user = await prisma.orm.public.User.where({ email }).first();
        if (!user) return null;
        return { ...toUserType(user), password: user.password };
    }

    async findById(id: string): Promise<userType | null> {
        const user = await prisma.orm.public.User.where({ id }).first();
        return user ? toUserType(user) : null;
    }

    async updateUsername(id: string, username: string): Promise<userType> {
        const user = await prisma.orm.public.User.where({ id }).update({ username: varchar(username) });
        if (!user) throw new Error("User not found");
        return toUserType(user);
    }

    async updateProfile(id: string, data: { username?: string; phone?: string }): Promise<userType | null> {
        const existing = await prisma.orm.public.User.where({ id }).first();
        if (!existing) return null;
        const user = await prisma.orm.public.User.where({ id }).update({
            ...(data.username !== undefined ? { username: varchar(data.username) } : {}),
            ...(data.phone !== undefined ? { phone: varchar(data.phone) } : {}),
        });
        return user ? toUserType(user) : null;
    }
}