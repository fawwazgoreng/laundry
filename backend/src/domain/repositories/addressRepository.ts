import type { addressCreateType, addressType, addressUpdateType } from "../types/addressType";

export interface addressRepository {
    listByUser(userId: string): Promise<addressType[]>
    findById(userId: string, id: number): Promise<addressType | null>
    create(userId: string, data: addressCreateType, isPrimary?: boolean): Promise<addressType>
    update(userId: string, id: number, data: addressUpdateType): Promise<addressType | null>
    remove(userId: string, id: number): Promise<boolean>
    setPrimary(userId: string, id: number): Promise<addressType | null>
    clearPrimary(userId: string, exceptId: number): Promise<void>
    countByUser(userId: string): Promise<number>
}