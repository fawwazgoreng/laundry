import type { statsRepository } from "../../domain/repositories/statsRepository";
import type { adminStatsType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";
import { fromInstant, instant, varchar } from "../prisma/scalars";

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function dayStart(offsetDays: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offsetDays);
    return d;
}

export class pgStatsRepository implements statsRepository {
    async getStats(): Promise<adminStatsType> {
        const today = startOfToday();

        const [ordersToday, revenueTodayAgg, inProgressAgg, productsSoldAgg, recentOrders, services, weeklyPayments, lowStock] =
            await Promise.all([
                prisma.orm.public.Orders.where((c) => c.created_at.gte(instant(today))).aggregate((agg) => ({ count: agg.count() })).then(r => r.count),
                prisma.orm.public.Payments
                    .where((p, { fns }) => fns.and(p.status.eq(varchar<30>("PAID")), p.paid_at.gte(instant(today))))
                    .aggregate((agg) => ({ sum: agg.sum("gross_amount") })),
                prisma.orm.public.Orders.where((o) => o.status.in([varchar<20>("DITERIMA"), varchar<20>("DIPROSES")])).aggregate((agg) => ({ count: agg.count() })).then(r => r.count),
                prisma.orm.public.Product_order_item
                    .where((poi) => poi.order.some((o) => o.created_at.gte(instant(today))))
                    .aggregate((agg) => ({ sum: agg.sum("qty") })),
                prisma.orm.public.Orders
                    .orderBy((o) => o.created_at.desc())
                    .limit(5)
                    .include("user", (u) => u.select("username", "phone"))
                    .include("serviceOrderItems", (si) => si.include("service", (s) => s.select("name")))
                    .include("productOrderItems", (pi) => pi.include("product", (p) => p.select("name")))
                    .all(),
                prisma.orm.public.Laundry_services
                    .select("id", "name")
                    .all(),
                prisma.orm.public.Payments
                    .where((p, { fns }) => fns.and(p.status.eq(varchar<30>("PAID")), p.paid_at.gte(instant(dayStart(6)))))
                    .select("gross_amount", "paid_at")
                    .all(),
                prisma.orm.public.Products
                    .where((p, { fns }) => fns.and(p.is_active.eq(true), p.stock.lte(5)))
                    .orderBy((p) => p.stock.asc())
                    .select("id", "name", "stock")
                    .all(),
            ]);

        const serviceRevenue = (
            await Promise.all(
                services.map(async (service) => {
                    const agg = await prisma.orm.public.Service_order_item
                        .where({ laundry_service_id: service.id })
                        .aggregate((a) => ({ total: a.sum("subtotal"), count: a.count() }));
                    return { service_name: service.name, total: Number(agg.total ?? 0), count: agg.count };
                }),
            )
        )
            .filter((row) => row.count > 0)
            .sort((a, b) => b.total - a.total);

        const weekly = new Map<string, number>();
        for (let i = 0; i < 7; i++) {
            const d = dayStart(i);
            const key = d.toISOString().slice(0, 10);
            weekly.set(key, 0);
        }
        for (const p of weeklyPayments) {
            if (!p.paid_at) continue;
            const key = fromInstant(p.paid_at).toISOString().slice(0, 10);
            if (weekly.has(key)) weekly.set(key, (weekly.get(key) ?? 0) + Number(p.gross_amount));
        }

        return {
            orders_today: ordersToday,
            revenue_today: Number(revenueTodayAgg.sum ?? 0),
            laundry_in_progress: inProgressAgg,
            products_sold: Number(productsSoldAgg.sum ?? 0),
            recent_orders: recentOrders.map((o) => {
                const svc = o.serviceOrderItems[0];
                const prod = o.productOrderItems[0];
                let summary = "Layanan laundry";
                if (svc) {
                    const num = `${Number(svc.qty) % 1 === 0 ? Number(svc.qty).toFixed(0) : Number(svc.qty).toFixed(1)} ${(svc.service as any)?.unit}`;
                    summary = `${(svc.service as any)?.name} ${num}`;
                } else if (prod) {
                    summary = `${(prod.product as any)?.name} ${prod.qty} ${(prod.product as any)?.size}`;
                }
                return {
                    order_id: o.order_id,
                    customer_name: (o.user as any)?.username ?? (o as any).customer_name,
                    customer_phone: (o.user as any)?.phone ?? (o as any).customer_phone,
                    status: o.status,
                    total_amount: o.total_amount,
                    items_summary: summary,
                    created_at: new Date(o.created_at.epochMilliseconds).toISOString(),
                };
            }),
            service_revenue: serviceRevenue,
            weekly_revenue: [...weekly.entries()]
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .map(([date, total]) => ({ date, total })),
            low_stock_products: lowStock,
        };
    }
}
