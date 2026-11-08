import type { registerType, userType, userWithPassword } from "../types/userType";

export interface userRepository {
    create(data: registerType): Promise<userType>
    findByEmail(email: string): Promise<userWithPassword | null>
    findById(id: string): Promise<userType | null>
    updateUsername(id: string, username: string): Promise<userType>
    updateProfile(id: string, data: { username?: string | undefined; phone?: string | undefined }): Promise<userType | null>
}