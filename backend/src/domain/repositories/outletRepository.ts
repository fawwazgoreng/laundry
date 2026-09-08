import type { outletType, outletUpdateType } from "../types/outletType";

export interface outletRepository {
    list(): Promise<outletType[]>
    findById(id: number): Promise<outletType | null>
    findFirst(): Promise<outletType | null>
    update(id: number, data: outletUpdateType): Promise<outletType | null>
}