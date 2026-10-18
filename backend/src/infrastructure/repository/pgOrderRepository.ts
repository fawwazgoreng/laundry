import { prisma } from "../prisma/prisma";
import { fromInstant, instant, numeric, varchar } from "../prisma/scalars";
import { AppError } from "../../helper/errorHandling/appError";
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

type ServiceItemRow = {
    id: string
    laundry_service_id: number
    qty: unknown
    subtotal: unknown
    notes: string
    service: {
        name: string
        unit: string
        price_per_unit: unknown
    } | null
};

type ProductItemRow = {
    id: string
    product_id: number
    qty: number
    subtotal: number
    product: {
        name: string
        category: string
        size: string
        image: string
        price: unknown
    } | null
};

type PaymentRow = {
    id: string
    transaction_id: string
    payment_type: string
    gross_amount: unknown
    status: string
    va_number: string | null
    paid_at: Temporal.Instant | null
    created_at: Temporal.Instant
    raw_response: unknown
};

type TrackingRow = {
    id: string
    status: string
    notes: string
    estimated_completion_time: Temporal.Instant
    created_at: Temporal.Instant
};

type OrderDetailRow = {
    id: string
    order_id: string
    status: string
    payment_method: string
    total_laundry: unknown
    total_product: unknown
    delivery_fee: unknown
    total_amount: number
    distance_km: unknown
    notes: string | null
    created_at: Temporal.Instant
    updated_at: Temporal.Instant
    user: {
        id: string
        username: string
        phone: string
        email: string
    } | null
    address: {
        id: number
        label: string
        address_text: string
    } | null
    outlet: {
        id: number
        name: string
        latitude: unknown
        longitude: unknown
    } | null
    serviceOrderItems: ServiceItemRow[]
    productOrderItems: ProductItemRow[]
    payments: PaymentRow[]
    orderTrackings: TrackingRow[]
};

type OrderListRow = {
    id: string
    order_id: string
    status: string
    total_amount: number
    payment_method: string
    created_at: Temporal.Instant
    user: {
        username: string
        phone: string
    } | null
    serviceOrderItems: {
        qty: unknown
        service: {
            name: string
            unit: string
        } | null
    }[]
    productOrderItems: {
        qty: number
        product: {
            name: string
            size: string
        } | null
    }[]
};

function toServiceItem(row: ServiceItemRow): serviceOrderItemType {
    const service = row.service;
    if (!service) throw new Error("service order item missing service");
    return {
        id: row.id,
        service_id: row.laundry_service_id,
        service_name: service.name,
        unit: service.unit,
        qty: Number(row.qty),
        price_per_unit: Number(service.price_per_unit),
        subtotal: Number(row.subtotal),
        notes: row.notes,
    };
}

function toProductItem(row: ProductItemRow): productOrderItemType {
    const product = row.product;
    if (!product) throw new Error("product order item missing product");
    return {
        id: row.id,
        product_id: row.product_id,
        product_name: product.name,
        category: product.category,
        size: product.size,
        image: product.image,
        qty: row.qty,
        price: Number(product.price),
        subtotal: row.subtotal,
    };
}

function toPayment(row: PaymentRow | undefined): paymentSummaryType | null {
    if (!row) return null;
    return {
        id: row.id,
        transaction_id: row.transaction_id,
        payment_type: row.payment_type as paymentSummaryType["payment_type"],
        gross_amount: Number(row.gross_amount),
        status: row.status,
        va_number: row.va_number,
        paid_at: row.paid_at ? fromInstant(row.paid_at).toISOString() : null,
        created_at: fromInstant(row.created_at).toISOString(),
        raw_response: row.raw_response as Record<string, unknown> | null,
    };
}

function toTracking(row: TrackingRow): orderTrackingType {
    return {
        id: row.id,
        status: row.status as orderStatus,
        notes: row.notes,
        estimated_completion_time: fromInstant(row.estimated_completion_time).toISOString(),
        created_at: fromInstant(row.created_at).toISOString(),
    };
}

function toOrderDetail(row: OrderDetailRow): orderDetailType {
    const payment = toPayment(row.payments[0]);
    const user = row.user;
    if (!user) throw new Error("order missing customer");
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
        created_at: fromInstant(row.created_at).toISOString(),
        updated_at: fromInstant(row.updated_at).toISOString(),
        customer: {
            id: user.id,
            username: user.username,
            phone: user.phone,
            email: user.email,
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
            .sort((a, b) => a.created_at.epochMilliseconds - b.created_at.epochMilliseconds)
            .map(toTracking),
    };
}

const orderDetailQuery = () =>
    prisma.orm.public.Orders
        .include("user", (u) => u.select("id", "username", "phone", "email"))
        .include("address", (a) => a.select("id", "label", "address_text"))
        .include("outlet", (o) => o.select("id", "name", "latitude", "longitude"))
        .include("payments", (p) => p.orderBy((r) => r.created_at.desc()).limit(1))
        .include("serviceOrderItems", (s) => s.include("service"))
        .include("productOrderItems", (p) => p.include("product"))
        .include("orderTrackings");

const orderListQuery = () =>
    prisma.orm.public.Orders
        .include("user", (u) => u.select("id", "username", "phone"))
        .include("serviceOrderItems", (s) => s.include("service"))
        .include("productOrderItems", (p) => p.include("product"));

export class pgOrderRepository implements orderRepository {
    async create(input: orderNewRecordType): Promise<orderDetailType> {
        await prisma.transaction(async (tx) => {
            await tx.orm.public.Orders.create({
                order_id: input.order_id,
                user_id: input.user_id,
                outlet_id: input.outlet_id,
                user_address_id: input.user_address_id,
                distance_km: numeric<6, 2>(input.distance_km),
                delivery_fee: numeric<10, 2>(input.delivery_fee),
                total_laundry: numeric<12, 2>(input.totals.total_laundry),
                total_product: numeric<12, 2>(input.totals.total_product),
                total_amount: input.totals.total_amount,
                status: varchar<20>(input.status),
                payment_method: varchar<20>(input.payment_method),
                notes: input.notes ?? null,
                serviceOrderItems: (items) => items.create(input.services.map((s) => ({
                    laundry_service_id: s.laundry_service_id,
                    qty: numeric<6, 2>(s.qty),
                    subtotal: numeric<12, 2>(s.subtotal),
                    notes: s.notes ?? "",
                }))),
                productOrderItems: (items) => items.create(input.products.map((p) => ({
                    product_id: p.product_id,
                    qty: p.qty,
                    subtotal: p.subtotal,
                }))),
                orderTrackings: (trackings) => trackings.create({
                    status: varchar<20>(input.tracking.status),
                    notes: input.tracking.notes,
                }),
            });
            for (const p of input.products) {
                const product = await tx.orm.public.Products.where({ id: p.product_id }).forUpdate().first();
                if (!product) throw AppError.conflict(`Produk id ${p.product_id} tidak ditemukan`);
                if (product.stock < p.qty) throw AppError.conflict(`Stok ${product.name} tidak mencukupi`);
                await tx.orm.public.Products.where({ id: p.product_id }).update({
                    stock: product.stock - p.qty,
                });
            }

            await tx.orm.public.Payments.create({
                order_id: input.order_id,
                transaction_id: input.payment.transaction_id ?? `TRX-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                payment_type: varchar<20>(input.payment.payment_type),
                gross_amount: numeric<12, 2>(input.payment.gross_amount),
                status: varchar<30>(input.payment.status),
                va_number: input.payment.va_number ?? null,
                paid_at: input.payment.paid_at ? instant(new Date(input.payment.paid_at)) : null,
                raw_response: (input.payment.raw_response ?? null) as any,
            });

            if (input.cashflow) {
                await tx.orm.public.Cash_flow.create({
                    order_id: input.order_id,
                    type: varchar<20>(input.cashflow.type),
                    category: varchar<40>(input.cashflow.category),
                    amount: numeric<12, 2>(input.cashflow.amount),
                    description: input.cashflow.description,
                });
            }
        });
        const fresh = await this.findByOrderId(input.order_id);
        if (!fresh) throw AppError.internal("Pesanan dibuat namun tidak ditemukan", { orderId: input.order_id });
        return fresh;
    }

    async findByOrderId(orderId: string): Promise<orderDetailType | null> {
        const row = await orderDetailQuery().where({ order_id: orderId }).first();
        return row ? toOrderDetail(row) : null;
    }

    async findById(id: string): Promise<orderDetailType | null> {
        const row = await orderDetailQuery().where({ id }).first();
        return row ? toOrderDetail(row) : null;
    }

    private async toListItems(rows: OrderListRow[]): Promise<orderListItemType[]> {
        return rows.map((row) => {
            const user = row.user;
            if (!user) throw new Error("order missing customer");
            const svc = row.serviceOrderItems[0];
            const prod = row.productOrderItems[0];
            let summary = "Layanan laundry";
            let unit = "-";
            if (svc && svc.service) {
                const num = `${Number(svc.qty) % 1 === 0 ? Number(svc.qty).toFixed(0) : Number(svc.qty).toFixed(1)} ${svc.service.unit}`;
                summary = `${svc.service.name} ${num}`;
                unit = num;
            } else if (prod && prod.product) {
                summary = `${prod.product.name} ${prod.qty} ${prod.product.size}`;
                unit = `${prod.qty} ${prod.product.size}`;
            }
            return {
                id: row.id,
                order_id: row.order_id,
                status: row.status as orderStatus,
                total_amount: row.total_amount,
                payment_method: row.payment_method as orderListItemType["payment_method"],
                created_at: fromInstant(row.created_at).toISOString(),
                customer_name: user.username,
                customer_phone: user.phone,
                items_summary: summary,
                items_unit: unit,
            };
        });
    }

    async listByUser(userId: string, filters: orderListFilters = {}): Promise<{ data: orderListItemType[]; count: number }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const base = orderListQuery().where((o, { fns }) => {
            const conditions = [o.user_id.eq(userId)];
            if (filters.status && filters.status !== "all") {
                conditions.push(o.status.eq(varchar<20>(filters.status)));
            }
            return fns.and(...conditions);
        });
        const [rows, countAgg] = await Promise.all([
            base.orderBy((o) => o.created_at.desc()).offset((page - 1) * perPage).limit(perPage).all(),
            base.aggregate((agg) => ({ count: agg.count() })),
        ]);
        return { data: await this.toListItems(rows), count: countAgg.count };
    }

    async listAll(filters: orderListFilters = {}): Promise<{ data: orderListItemType[]; count: number }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const base = orderListQuery().where((o, { fns }) => {
            const conditions = [];
            if (filters.status && filters.status !== "all") {
                conditions.push(o.status.eq(varchar<20>(filters.status)));
            }
            if (filters.search) {
                const term = filters.search;
                conditions.push(fns.or(
                    o.order_id.ilike(`%${term}%`),
                    o.user.some((u) => u.username.ilike(`%${term}%`)),
                    o.user.some((u) => u.phone.like(`%${term}%`)),
                ));
            }
            if (filters.service) {
                const term = filters.service;
                conditions.push(
                    o.serviceOrderItems.some((s) => s.service.some((svc) => svc.name.ilike(`%${term}%`))),
                );
            }
            return fns.and(...(conditions.length > 0 ? conditions : [o.id.isNotNull()]));
        });
        const [rows, countAgg] = await Promise.all([
            base.orderBy((o) => o.created_at.desc()).offset((page - 1) * perPage).limit(perPage).all(),
            base.aggregate((agg) => ({ count: agg.count() })),
        ]);
        return { data: await this.toListItems(rows), count: countAgg.count };
    }

    async updateStatus(orderId: string, status: orderStatus): Promise<void> {
        await prisma.transaction(async (tx) => {
            await tx.orm.public.Orders.where({ order_id: orderId }).update({
                status: varchar<20>(status),
            });
            if (status === "DIBATALKAN") {
                const items = await tx.orm.public.Product_order_item.where({ order_id: orderId }).all();
                for (const item of items) {
                    const product = await tx.orm.public.Products.where({ id: item.product_id }).forUpdate().first();
                    if (product) {
                        await tx.orm.public.Products.where({ id: item.product_id }).update({
                            stock: product.stock + item.qty,
                        });
                    }
                }
            }
        });
    }

    async addTracking(orderId: string, status: orderStatus, notes: string): Promise<void> {
        await prisma.orm.public.Order_trackings.create({
            order_id: orderId,
            status: varchar<20>(status),
            notes,
        });
    }

    async countByDatePrefix(prefix: string): Promise<number> {
        const agg = await prisma.orm.public.Orders
            .where((o) => o.order_id.like(`${prefix}%`))
            .aggregate((a) => ({ count: a.count() }));
        return agg.count;
    }

    async countByStatusUser(userId: string, status?: string): Promise<number> {
        const agg = await prisma.orm.public.Orders
            .where((o, { fns }) => {
                const conditions = [o.user_id.eq(userId)];
                if (status) conditions.push(o.status.eq(varchar<20>(status)));
                return fns.and(...conditions);
            })
            .aggregate((a) => ({ count: a.count() }));
        return agg.count;
    }
}
