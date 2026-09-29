import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../prisma/prisma";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type {
    orderDetailType,
    orderListFilters,
    orderListItemType,
    orderNewRecordType,
    orderStatus,
    serviceOrderItemType,
    productOrderItemType,
    paymentSummaryType,
    orderTrackingType,
} from "../../domain/types/orderType";

type OrderRow = Prisma.OrdersGetPayload<{
    include: {
        user: { select: { id: true; username: true; phone: true; email: true } }
        address: { select: { id: true; label: true; address_text: true } }
        outlet: { select: { id: true; name: true; latitude: true; longitude: true } }
        payments: true
        serviceOrderItems: { include: { service: true } }
        productOrderItems: { include: { product: true } }
        orderTrackings: true
    }
}>;

function toServiceItem(row: OrderRow["serviceOrderItems"][number]): serviceOrderItemType {
    return {
        id: row.id,
        service_id: row.laundry_service_id,
        service_name: row.service.name,
        unit: row.service.unit,
        qty: Number(row.qty),
        price_per_unit: Number(row.service.price_per_unit),
        subtotal: Number(row.subtotal),
        notes: row.notes,
    };
}

function toProductItem(row: OrderRow["productOrderItems"][number]): productOrderItemType {
    return {
        id: row.id,
        product_id: row.product_id,
        product_name: row.product.name,
        category: row.product.category,
        size: row.product.size,
        image: row.product.image,
        qty: row.qty,
        price: Number(row.product.price),
        subtotal: row.subtotal,
    };
}

function toPayment(row: OrderRow["payments"][number] | undefined): paymentSummaryType | null {
    if (!row) return null;
    return {
        id: row.id,
        transaction_id: row.transaction_id,
        payment_type: row.payment_type as paymentSummaryType["payment_type"],
        gross_amount: Number(row.gross_amount),
        status: row.status,
        paid_at: row.paid_at ? row.paid_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
        raw_response: row.raw_response as Record<string, unknown> | null,
    };
}

function toTracking(row: OrderRow["orderTrackings"][number]): orderTrackingType {
    return {
        id: row.id,
        status: row.status as orderStatus,
        notes: row.notes,
        estimated_completion_time: row.estimated_completion_time.toISOString(),
        created_at: row.created_at.toISOString(),
    };
}

function toOrderDetail(row: OrderRow): orderDetailType {
    const payment = toPayment(row.payments[0]);
    return {
        id: row.id,
        order_id: row.order_id,
        status: row.status as orderStatus,
        payment_method: row.payment_method as orderDetailType["payment_method"],
        total_laundry: Number(row.total_laundry),
        total_product: Number(row.total_product),
        delivery_fee: Number(row.delivery_fee),
        total_amount: row.total_amount,
        distance_km: Number(row.distance_km),
        notes: row.notes,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        customer: {
            id: row.user.id,
            username: row.user.username,
            phone: row.user.phone,
            email: row.user.email,
        },
        address: row.address
            ? { id: row.address.id, label: row.address.label, address_text: row.address.address_text }
            : null,
        outlet: row.outlet
            ? { id: row.outlet.id, name: row.outlet.name, latitude: Number(row.outlet.latitude), longitude: Number(row.outlet.longitude) }
            : null,
        services: row.serviceOrderItems.map(toServiceItem),
        products: row.productOrderItems.map(toProductItem),
        payment,
        trackings: row.orderTrackings
            .slice()
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
            .map(toTracking),
    };
}

const orderInclude = {
    user: { select: { id: true, username: true, phone: true, email: true } },
    address: { select: { id: true, label: true, address_text: true } },
    outlet: { select: { id: true, name: true, latitude: true, longitude: true } },
    payments: { orderBy: { created_at: "desc" as const }, take: 1 },
    serviceOrderItems: { include: { service: true } },
    productOrderItems: { include: { product: true } },
    orderTrackings: true,
} satisfies Prisma.OrdersInclude;

export class pgOrderRepository implements orderRepository {
    async create(input: orderNewRecordType): Promise<orderDetailType> {
        await prisma.$transaction(async (tx) => {
            await tx.orders.create({
                data: {
                    order_id: input.order_id,
                    user_id: input.user_id,
                    outlet_id: input.outlet_id,
                    user_address_id: input.user_address_id,
                    distance_km: input.distance_km,
                    delivery_fee: input.delivery_fee,
                    total_laundry: input.totals.total_laundry,
                    total_product: input.totals.total_product,
                    total_amount: input.totals.total_amount,
                    status: input.status,
                    payment_method: input.payment_method,
                    notes: input.notes ?? null,
                    serviceOrderItems: {
                        create: input.services.map((s) => ({
                            service: { connect: { id: s.laundry_service_id } },
                            qty: s.qty,
                            subtotal: s.subtotal,
                            notes: s.notes ?? "",
                        })),
                    },
                    productOrderItems: {
                        create: input.products.map((p) => ({
                            product: { connect: { id: p.product_id } },
                            qty: p.qty,
                            subtotal: p.subtotal,
                        })),
                    },
                    orderTrackings: {
                        create: {
                            status: input.tracking.status,
                            notes: input.tracking.notes,
                        },
                    },
                },
            });
            for (const p of input.products) {
                await tx.products.update({
                    where: { id: p.product_id },
                    data: { stock: { decrement: p.qty } },
                });
            }
        });
        const fresh = await this.findByOrderId(input.order_id);
        if (!fresh) throw new Error("order created but not found");
        return fresh;
    }

    async findByOrderId(orderId: string): Promise<orderDetailType | null> {
        const row = await prisma.orders.findUnique({
            where: { order_id: orderId },
            include: orderInclude,
        });
        return row ? toOrderDetail(row) : null;
    }

    async findById(id: string): Promise<orderDetailType | null> {
        const row = await prisma.orders.findUnique({
            where: { id },
            include: orderInclude,
        });
        return row ? toOrderDetail(row) : null;
    }

    private async toListItems(
        rows: Prisma.OrdersGetPayload<{ include: { user: { select: { id: true; username: true; phone: true } }; serviceOrderItems: { include: { service: true } }; productOrderItems: { include: { product: true } } } }>[],
    ): Promise<orderListItemType[]> {
        return rows.map((row) => {
            const svc = row.serviceOrderItems[0];
            const prod = row.productOrderItems[0];
            let summary = "Layanan laundry";
            let unit = "-";
            if (svc) {
                const num = `${Number(svc.qty) % 1 === 0 ? Number(svc.qty).toFixed(0) : Number(svc.qty).toFixed(1)} ${svc.service.unit}`;
                summary = `${svc.service.name} ${num}`;
                unit = num;
            } else if (prod) {
                summary = `${prod.product.name} ${prod.qty} ${prod.product.size}`;
                unit = `${prod.qty} ${prod.product.size}`;
            }
            return {
                id: row.id,
                order_id: row.order_id,
                status: row.status as orderStatus,
                total_amount: row.total_amount,
                payment_method: row.payment_method as orderListItemType["payment_method"],
                created_at: row.created_at.toISOString(),
                customer_name: row.user.username,
                customer_phone: row.user.phone,
                items_summary: summary,
                items_unit: unit,
            };
        });
    }

    async listByUser(userId: string, filters: orderListFilters = {}): Promise<{ data: orderListItemType[]; count: number }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const where: Prisma.OrdersWhereInput = {
            user_id: userId,
        };
        if (filters.status && filters.status !== "all") {
            where.status = filters.status;
        }
        const [rows, count] = await Promise.all([
            prisma.orders.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, phone: true } },
                    serviceOrderItems: { include: { service: true } },
                    productOrderItems: { include: { product: true } },
                },
                orderBy: { created_at: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.orders.count({ where }),
        ]);
        return { data: await this.toListItems(rows), count };
    }

    async listAll(filters: orderListFilters = {}): Promise<{ data: orderListItemType[]; count: number }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const where: Prisma.OrdersWhereInput = {};

        if (filters.status && filters.status !== "all") {
            where.status = filters.status;
        }
        if (filters.search) {
            where.OR = [
                { order_id: { contains: filters.search, mode: "insensitive" } },
                { user: { username: { contains: filters.search, mode: "insensitive" } } },
                { user: { phone: { contains: filters.search } } },
            ];
        }
        if (filters.service) {
            where.serviceOrderItems = {
                some: { service: { name: { contains: filters.service, mode: "insensitive" } } },
            };
        }

        const [rows, count] = await Promise.all([
            prisma.orders.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, phone: true } },
                    serviceOrderItems: { include: { service: true } },
                    productOrderItems: { include: { product: true } },
                },
                orderBy: { created_at: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.orders.count({ where }),
        ]);
        return { data: await this.toListItems(rows), count };
    }

    async updateStatus(orderId: string, status: orderStatus): Promise<void> {
        await prisma.$transaction(async (tx) => {
            await tx.orders.update({ where: { order_id: orderId }, data: { status } });
            if (status === "DIBATALKAN") {
                const items = await tx.product_order_item.findMany({ where: { order_id: orderId } });
                for (const item of items) {
                    await tx.products.update({
                        where: { id: item.product_id },
                        data: { stock: { increment: item.qty } },
                    });
                }
            }
        });
    }

    async addTracking(orderId: string, status: orderStatus, notes: string): Promise<void> {
        await prisma.order_trackings.create({
            data: { order_id: orderId, status, notes },
        });
    }

    async countByDatePrefix(prefix: string): Promise<number> {
        return prisma.orders.count({ where: { order_id: { startsWith: prefix } } });
    }

    async countByStatusUser(userId: string, status?: string): Promise<number> {
        return prisma.orders.count({ where: { user_id: userId, ...(status ? { status } : {}) } });
    }
}