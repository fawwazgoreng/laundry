import type {
    orderCreateType,
    orderDetailType,
    orderListFilters,
    orderListItemType,
    orderNewRecordType,
    orderStatus,
} from "../types/orderType";

export interface orderRepository {
    create(input: orderNewRecordType): Promise<orderDetailType>
    findByOrderId(orderId: string): Promise<orderDetailType | null>
    findById(id: string): Promise<orderDetailType | null>
    listByUser(userId: string, filters: orderListFilters): Promise<{ data: orderListItemType[]; count: number }>
    listAll(filters: orderListFilters): Promise<{ data: orderListItemType[]; count: number }>
    updateStatus(orderId: string, status: orderStatus): Promise<void>
    addTracking(orderId: string, status: orderStatus, notes: string): Promise<void>
    delete(orderId: string): Promise<void>
    countByDatePrefix(prefix: string): Promise<number>
    countByStatusUser(userId: string, status?: string): Promise<number>
}