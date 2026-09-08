import type { serviceCreateType, serviceType, serviceUpdateType } from "../types/serviceType";

export interface serviceRepository {
    list(activeOnly?: boolean): Promise<serviceType[]>
    findById(id: number): Promise<serviceType | null>
    create(data: serviceCreateType): Promise<serviceType>
    update(id: number, data: serviceUpdateType): Promise<serviceType | null>
    remove(id: number): Promise<boolean>
}