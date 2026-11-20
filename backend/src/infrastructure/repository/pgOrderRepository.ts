import { prisma } from "../prisma/prisma";
import { fromJsonText, jsonText, numeric, varchar } from "../prisma/scalars";
import type { Models } from "../database/generated/contract";
import Decimal from "decimal.js";
import { money } from "../../lib/money";
import { AppError } from "../../helper/errorHandling/appError";
import { orderEntity } from "../../domain/entities/orderEntity";
import type { orderRepository } from "../../domain/repositories/orderRepository";
import type {
    orderDetailType,
    orderListFilters,
    orderListItemType,
    orderNewRecordType,
    orderStatus,
    serviceOrderItemType,
    serviceOrderAddonType,
    productOrderItemType,
    paymentSummaryType,
    orderTrackingType,
} from "../../domain/types/orderType";
import type { refundSummaryType, refundStatus } from "../../domain/types/refundType";
import type { addonPriceMode } from "../../domain/types/serviceType";

type ServiceAddonRow = Pick<
    Models.Service_order_item_addons,
    "id" | "group_code" | "group_name" | "option_name" | "price" | "price_mode" | "qty" | "subtotal"
>;

type ServiceItemRow = {
    id: string
    laundry_service_id: number
    qty: string
    price_per_unit: string
    addon_subtotal: string
    subtotal: string
    notes: string
    service: {
        name: string
        unit: string
        price_per_unit: string
        estimated_duration_hours: number
    } | null
    addons: ServiceAddonRow[]
};

type ProductAddonRow = Pick<
    Models.Product_order_item_addons,
    "id" | "group_code" | "group_name" | "option_name" | "price" | "price_mode" | "qty" | "subtotal"
>;

type ProductItemRow = {
    id: string
    product_id: number
    qty: number
    subtotal: string
    product: {
        name: string
        category: string
        size: string
        image: string
        price: string
    } | null
    addons: ProductAddonRow[]
};

type RefundRow = Pick<Models.Refund_requests, "id" | "status" | "amount" | "reason" | "gateway_ref" | "requested_at" | "processed_at">;

type PaymentRow = Pick<
    Models.Payments,
    "id" | "transaction_id" | "payment_type" | "gross_amount" | "status" | "va_number" | "paid_at" | "created_at" | "raw_response"
>;

type TrackingRow = Pick<Models.Order_trackings, "id" | "status" | "notes" | "estimated_completion_time" | "created_at">;

type OrderDetailRow = {
    id: string
    order_id: string
    status: string
    payment_method: string
    total_laundry: string
    total_product: string
    total_addon: string
    delivery_fee: string
    total_amount: string
    distance_km: string
    latitude: string | null
    longitude: string | null
    notes: string | null
    created_at: Date
    updated_at: Date
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
        latitude: string
        longitude: string
    } | null
    outlet: {
        id: number
        name: string
        latitude: string
        longitude: string
    } | null
    serviceOrderItems: ServiceItemRow[]
    productOrderItems: ProductItemRow[]
    payments: PaymentRow[]
    refundRequests: RefundRow[]
    orderTrackings: TrackingRow[]
};

type OrderListRow = {
    id: string
    order_id: string
    status: string
    total_amount: string
    payment_method: string
    created_at: Date
    user: {
        id: string
        username: string
        phone: string
    } | null
    payments: {
        status: string
    }[]
    refundRequests: {
        status: string
    }[]
    serviceOrderItems: {
        qty: string
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

function toServiceAddon(row: ServiceAddonRow): serviceOrderAddonType {
    return {
        id: row.id,
        group_code: row.group_code,
        group_name: row.group_name,
        option_name: row.option_name,
        price: money(row.price),
        price_mode: row.price_mode as addonPriceMode,
        qty: Number(row.qty),
        subtotal: money(row.subtotal),
    };
}

function toServiceItem(row: ServiceItemRow): serviceOrderItemType {
    const service = row.service;
    if (!service) throw new Error("service order item missing service");
    return {
        id: row.id,
        service_id: row.laundry_service_id,
        service_name: service.name,
        unit: service.unit,
        estimated_duration_hours: service.estimated_duration_hours,
        qty: Number(row.qty),
        price_per_unit: money(new Decimal(row.price_per_unit).isZero() ? new Decimal(service.price_per_unit) : new Decimal(row.price_per_unit)),
        addon_subtotal: money(row.addon_subtotal),
        addons: row.addons.map(toServiceAddon),
        subtotal: money(row.subtotal),
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
        price: money(product.price),
        addons: row.addons.map(toServiceAddon),
        subtotal: money(row.subtotal),
    };
}

function toPayment(row: PaymentRow | undefined): paymentSummaryType | null {
    if (!row) return null;
    return {
        id: row.id,
        transaction_id: row.transaction_id,
        payment_type: row.payment_type as paymentSummaryType["payment_type"],
        gross_amount: money(row.gross_amount),
        status: row.status,
        va_number: row.va_number,
        paid_at: row.paid_at ? row.paid_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
        raw_response: fromJsonText(row.raw_response),
    };
}

function toTracking(row: TrackingRow): orderTrackingType {
    return {
        id: row.id,
        status: row.status as orderStatus,
        notes: row.notes,
        estimated_completion_time: row.estimated_completion_time.toISOString(),
        created_at: row.created_at.toISOString(),
    };
}

function toRefundSummary(row: RefundRow | undefined): refundSummaryType | null {
    if (!row) return null;
    return {
        id: row.id,
        status: row.status as refundStatus,
        amount: money(row.amount),
        reason: row.reason,
        gateway_ref: row.gateway_ref,
        requested_at: row.requested_at.toISOString(),
        processed_at: row.processed_at ? row.processed_at.toISOString() : null,
    };
}

function toOrderDetail(row: OrderDetailRow): orderDetailType {
    const payment = toPayment(row.payments[0]);
    const user = row.user;
    if (!user) throw new Error("order missing customer");
    const kind = orderEntity.deriveKind(row.serviceOrderItems.length, row.productOrderItems.length);
    return {
        id: row.id,
        order_id: row.order_id,
        status: row.status as orderStatus,
        order_type: kind,
        refund_eligible: orderEntity.isRefundEligible(kind, row.payment_method, payment?.status ?? null),
        payment_method: row.payment_method as orderDetailType["payment_method"],
        total_laundry: money(row.total_laundry),
        total_product: money(row.total_product),
        total_addon: money(row.total_addon),
        delivery_fee: money(row.delivery_fee),
        total_amount: money(row.total_amount),
        distance_km: Number(row.distance_km),
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        notes: row.notes,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        customer: {
            id: user.id,
            username: user.username,
            phone: user.phone,
            email: user.email,
        },
        address: row.address
            ? {
                id: row.address.id,
                label: row.address.label,
                address_text: row.address.address_text,
                latitude: Number(row.address.latitude),
                longitude: Number(row.address.longitude),
            }
            : null,
        outlet: row.outlet
            ? { id: row.outlet.id, name: row.outlet.name, latitude: Number(row.outlet.latitude), longitude: Number(row.outlet.longitude) }
            : null,
        services: row.serviceOrderItems.map(toServiceItem),
        products: row.productOrderItems.map(toProductItem),
        payment,
        refund: toRefundSummary(row.refundRequests[0]),
        trackings: row.orderTrackings
            .slice()
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
            .map(toTracking),
    };
}

const orderDetailQuery = () =>
    prisma.orm.Orders
        .include("user", (u) => u.select("id", "username", "phone", "email"))
        .include("address", (a) => a.select("id", "label", "address_text", "latitude", "longitude"))
        .include("outlet", (o) => o.select("id", "name", "latitude", "longitude"))
        .include("payments", (p) => p.orderBy((r) => r.created_at.desc()).limit(1))
        .include("serviceOrderItems", (s) => s.include("service").include("addons"))
        .include("productOrderItems", (p) => p.include("product").include("addons"))
        .include("refundRequests", (r) => r.orderBy((refund) => refund.requested_at.desc()).limit(1))
        .include("orderTrackings");

const orderListQuery = () =>
    prisma.orm.Orders
        .include("user", (u) => u.select("id", "username", "phone"))
        .include("payments", (p) => p.select("status").orderBy((r) => r.created_at.desc()).limit(1))
        .include("serviceOrderItems", (s) => s.include("service"))
        .include("productOrderItems", (p) => p.include("product"))
        .include("refundRequests", (r) => r.select("status").orderBy((refund) => refund.requested_at.desc()).limit(1));

export class pgOrderRepository implements orderRepository {
    async create(input: orderNewRecordType): Promise<orderDetailType> {
        await prisma.transaction(async (tx) => {
            await tx.orm.Orders.create({
                order_id: input.order_id,
                user_id: input.user_id,
                outlet_id: input.outlet_id,
                user_address_id: input.user_address_id,
                distance_km: numeric<6, 2>(input.distance_km),
                latitude: numeric<10, 8>(input.latitude),
                longitude: numeric<11, 8>(input.longitude),
                delivery_fee: numeric<10, 2>(input.delivery_fee),
                total_laundry: numeric<12, 2>(input.totals.total_laundry),
                total_product: numeric<12, 2>(input.totals.total_product),
                total_addon: numeric<12, 2>(input.totals.total_addon),
                total_amount: numeric<12, 2>(input.totals.total_amount),
                status: varchar<20>(input.status),
                payment_method: varchar<20>(input.payment_method),
                notes: input.notes ?? null,
                orderTrackings: (trackings) => trackings.create({
                    status: varchar<20>(input.tracking.status),
                    notes: input.tracking.notes,
                }),
            });

            for (const s of input.services) {
                const item = await tx.orm.Service_order_item.create({
                    order_id: input.order_id,
                    laundry_service_id: s.laundry_service_id,
                    qty: numeric<6, 2>(s.qty),
                    price_per_unit: numeric<12, 2>(s.price_per_unit),
                    addon_subtotal: numeric<12, 2>(s.addon_subtotal),
                    subtotal: numeric<12, 2>(s.subtotal),
                    notes: s.notes ?? "",
                });
                for (const addon of s.addons) {
                    await tx.orm.Service_order_item_addons.create({
                        service_order_item_id: item.id,
                        addon_option_id: addon.addon_option_id,
                        group_code: varchar<30>(addon.group_code),
                        group_name: varchar<50>(addon.group_name),
                        option_name: varchar<50>(addon.option_name),
                        price: numeric<12, 2>(addon.price),
                        price_mode: varchar<20>(addon.price_mode),
                        qty: numeric<6, 2>(addon.qty),
                        subtotal: numeric<12, 2>(addon.subtotal),
                    });
                }
            }

            for (const p of input.products) {
                const product = await tx.orm.Products.where({ id: p.product_id }).first();
                if (!product) throw AppError.conflict(`Produk id ${p.product_id} tidak ditemukan`);
                if (product.stock < p.qty) throw AppError.conflict(`Stok ${product.name} tidak mencukupi`);
                await tx.orm.Products.where({ id: p.product_id }).update({
                    stock: product.stock - p.qty,
                });
                const productItem = await tx.orm.Product_order_item.create({
                    order_id: input.order_id,
                    product_id: p.product_id,
                    qty: p.qty,
                    subtotal: numeric<12, 2>(p.subtotal),
                });
                for (const addon of p.addons) {
                    await tx.orm.Product_order_item_addons.create({
                        product_order_item_id: productItem.id,
                        addon_option_id: addon.addon_option_id,
                        group_code: varchar<30>(addon.group_code),
                        group_name: varchar<50>(addon.group_name),
                        option_name: varchar<50>(addon.option_name),
                        price: numeric<12, 2>(addon.price),
                        price_mode: varchar<20>(addon.price_mode),
                        qty: numeric<6, 2>(addon.qty),
                        subtotal: numeric<12, 2>(addon.subtotal),
                    });
                }
            }

            await tx.orm.Payments.create({
                order_id: input.order_id,
                transaction_id: input.payment.transaction_id ?? `TRX-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                payment_type: varchar<20>(input.payment.payment_type),
                gross_amount: numeric<12, 2>(input.payment.gross_amount),
                status: varchar<30>(input.payment.status),
                va_number: input.payment.va_number ?? null,
                paid_at: input.payment.paid_at ? new Date(input.payment.paid_at) : null,
                raw_response: jsonText(input.payment.raw_response ?? null),
            });

            if (input.cashflow) {
                await tx.orm.Cash_flow.create({
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
            const kind = orderEntity.deriveKind(row.serviceOrderItems.length, row.productOrderItems.length);
            const paymentStatus = row.payments[0]?.status ?? null;
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
                order_type: kind,
                refund_eligible: orderEntity.isRefundEligible(kind, row.payment_method, paymentStatus),
                refund_status: (row.refundRequests[0]?.status as refundStatus | undefined) ?? null,
                total_amount: money(row.total_amount),
                payment_method: row.payment_method as orderListItemType["payment_method"],
                payment_status: paymentStatus,
                created_at: row.created_at.toISOString(),
                customer_id: user.id,
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
        const [rows, countRows] = await Promise.all([
            base.orderBy((o) => o.created_at.desc()).offset((page - 1) * perPage).limit(perPage).all(),
            prisma.query(
                prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\`
                    WHERE \`user_id\` = ${userId}
                      AND (${filters.status && filters.status !== "all" ? 0 : 1} = 1 OR \`status\` = ${filters.status ?? ""})`
                    .returnsRow({ n: "mysql/bigint@1" })
                    .build(),
            ),
        ]);
        return { data: await this.toListItems(rows), count: Number(countRows[0]?.n ?? 0n) };
    }

    async listAll(filters: orderListFilters = {}): Promise<{ data: orderListItemType[]; count: number }> {
        const page = filters.page ?? 1;
        const perPage = filters.perPage ?? 10;
        const base = orderListQuery().where((o, { fns }) => {
            const conditions = [];
            if (filters.status && filters.status !== "all") {
                conditions.push(o.status.eq(varchar<20>(filters.status)));
            }
            if (filters.customer) {
                const term = filters.customer;
                const byUsername = o.user.some((u) => u.username.like(`%${term}%`));
                const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
                conditions.push(
                    looksLikeId ? fns.or(byUsername, o.user.some((u) => u.id.eq(term))) : byUsername,
                );
            }
            if (filters.search) {
                const term = filters.search;
                conditions.push(fns.or(
                    o.order_id.like(`%${term}%`),
                    o.user.some((u) => u.username.like(`%${term}%`)),
                    o.user.some((u) => u.phone.like(`%${term}%`)),
                ));
            }
            if (filters.service) {
                const term = filters.service;
                conditions.push(
                    o.serviceOrderItems.some((s) => s.service.some((svc) => svc.name.like(`%${term}%`))),
                );
            }
            return fns.and(...(conditions.length > 0 ? conditions : [o.id.isNotNull()]));
        });
        const statusFilter = filters.status && filters.status !== "all" ? filters.status : null;
        const customerTerm = filters.customer ?? null;
        const searchTerm = filters.search ?? null;
        const serviceTerm = filters.service ?? null;
        const customerIsId = customerTerm !== null
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerTerm);

        const [rows, countRows] = await Promise.all([
            base.orderBy((o) => o.created_at.desc()).offset((page - 1) * perPage).limit(perPage).all(),
            prisma.query(
                prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\` o
                    WHERE (${statusFilter === null ? 1 : 0} = 1 OR o.\`status\` = ${statusFilter ?? ""})
                      AND (${customerTerm === null ? 1 : 0} = 1 OR EXISTS (
                          SELECT 1 FROM \`User\` u
                          WHERE u.\`id\` = o.\`user_id\`
                            AND (u.\`username\` LIKE ${`%${customerTerm ?? ""}%`}
                              OR (${customerIsId ? 1 : 0} = 1 AND u.\`id\` = ${customerTerm ?? ""}))))
                      AND (${searchTerm === null ? 1 : 0} = 1 OR o.\`order_id\` LIKE ${`%${searchTerm ?? ""}%`}
                          OR EXISTS (
                              SELECT 1 FROM \`User\` u
                              WHERE u.\`id\` = o.\`user_id\`
                                AND (u.\`username\` LIKE ${`%${searchTerm ?? ""}%`} OR u.\`phone\` LIKE ${`%${searchTerm ?? ""}%`})))
                      AND (${serviceTerm === null ? 1 : 0} = 1 OR EXISTS (
                          SELECT 1 FROM \`Service_order_item\` si
                          JOIN \`Laundry_services\` ls ON ls.\`id\` = si.\`laundry_service_id\`
                          WHERE si.\`order_id\` = o.\`order_id\` AND ls.\`name\` LIKE ${`%${serviceTerm ?? ""}%`}))`
                    .returnsRow({ n: "mysql/bigint@1" })
                    .build(),
            ),
        ]);
        return { data: await this.toListItems(rows), count: Number(countRows[0]?.n ?? 0n) };
    }

    async updateStatus(orderId: string, status: orderStatus): Promise<void> {
        await prisma.transaction(async (tx) => {
            await tx.orm.Orders.where({ order_id: orderId }).update({
                status: varchar<20>(status),
            });
            if (status === "DIBATALKAN") {
                const items = await tx.orm.Product_order_item.where({ order_id: orderId }).all();
                for (const item of items) {
                    const product = await tx.orm.Products.where({ id: item.product_id }).first();
                    if (product) {
                        await tx.orm.Products.where({ id: item.product_id }).update({
                            stock: product.stock + item.qty,
                        });
                    }
                }
            }
        });
    }

    async addTracking(orderId: string, status: orderStatus, notes: string): Promise<void> {
        await prisma.orm.Order_trackings.create({
            order_id: orderId,
            status: varchar<20>(status),
            notes,
        });
    }

    async delete(orderId: string): Promise<void> {
        await prisma.transaction(async (tx) => {
            // Riwayat kas tetap disimpan, hanya tautan ke order yang dilepas.
            await tx.orm.Cash_flow.where({ order_id: orderId }).updateAll({ order_id: null });
            await tx.orm.Refund_requests.where({ order_id: orderId }).deleteAll();
            await tx.orm.Order_trackings.where({ order_id: orderId }).deleteAll();
            await tx.orm.Payments.where({ order_id: orderId }).deleteAll();
            await tx.orm.Product_order_item.where({ order_id: orderId }).deleteAll();
            const serviceItems = await tx.orm.Service_order_item.where({ order_id: orderId }).all();
            for (const item of serviceItems) {
                await tx.orm.Service_order_item_addons.where({ service_order_item_id: item.id }).deleteAll();
            }
            await tx.orm.Service_order_item.where({ order_id: orderId }).deleteAll();
            await tx.orm.Orders.where({ order_id: orderId }).deleteAll();
        });
    }

    async countByDatePrefix(prefix: string): Promise<number> {
        const [row] = await prisma.query(
            prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\` WHERE \`order_id\` LIKE ${`${prefix}%`}`
                .returnsRow({ n: "mysql/bigint@1" })
                .build(),
        );
        return Number(row?.n ?? 0n);
    }

    async countByStatusUser(userId: string, status?: string): Promise<number> {
        const [row] = await prisma.query(
            prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\`
                WHERE \`user_id\` = ${userId}
                  AND (${status ? 0 : 1} = 1 OR \`status\` = ${status ?? ""})`
                .returnsRow({ n: "mysql/bigint@1" })
                .build(),
        );
        return Number(row?.n ?? 0n);
    }
}
