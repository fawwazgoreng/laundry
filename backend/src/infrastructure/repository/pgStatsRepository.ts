import type { statsRepository } from "../../domain/repositories/statsRepository";
import type { adminStatsType } from "../../domain/types/adminType";
import { param } from "@prisma/orm-mysql/relational-core/expression";
import { prisma } from "../prisma/prisma";
import { varchar } from "../prisma/scalars";
import Decimal from "decimal.js";
import { money } from "../../lib/money";

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
        const todayParam = param(today, { codecId: "mysql/datetime@1" });

        const [ordersToday, revenueToday, inProgress, productsSold, recentOrders, services, weeklyPayments, lowStock] =
            await Promise.all([
                prisma.query(
                    prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\` WHERE \`created_at\` >= ${todayParam}`
                        .returnsRow({ n: "mysql/bigint@1" })
                        .build(),
                ).then((rows) => Number(rows[0]?.n ?? 0n)),
                prisma.query(
                    prisma.raw.sql`SELECT COALESCE(SUM(CAST(\`gross_amount\` AS DECIMAL(20, 2))), 0) AS total
                        FROM \`Payments\` WHERE \`status\` = 'PAID' AND \`paid_at\` >= ${todayParam}`
                        .returnsRow({ total: "mysql/text@1" })
                        .build(),
                ).then((rows) => rows[0]?.total ?? "0"),
                prisma.query(
                    prisma.raw.sql`SELECT COUNT(*) AS n FROM \`Orders\` WHERE \`status\` IN ('DITERIMA', 'DIPROSES')`
                        .returnsRow({ n: "mysql/bigint@1" })
                        .build(),
                ).then((rows) => Number(rows[0]?.n ?? 0n)),
                prisma.query(
                    prisma.raw.sql`SELECT COALESCE(SUM(poi.\`qty\`), 0) AS n
                        FROM \`Product_order_item\` poi
                        JOIN \`Orders\` o ON poi.\`order_id\` = o.\`order_id\`
                        WHERE o.\`created_at\` >= ${todayParam}`
                        .returnsRow({ n: "mysql/bigint@1" })
                        .build(),
                ).then((rows) => Number(rows[0]?.n ?? 0n)),
                prisma.orm.Orders
                    .orderBy((o) => o.created_at.desc())
                    .limit(5)
                    .include("user", (u) => u.select("username", "phone"))
                    .include("serviceOrderItems", (si) => si.include("service", (s) => s.select("name", "unit")))
                    .include("productOrderItems", (pi) => pi.include("product", (p) => p.select("name", "size")))
                    .all(),
                prisma.orm.Laundry_services
                    .select("id", "name")
                    .all(),
                prisma.orm.Payments
                    .where((p, { fns }) => fns.and(p.status.eq(varchar<30>("PAID")), p.paid_at.gte(dayStart(6))))
                    .select("gross_amount", "paid_at")
                    .all(),
                prisma.orm.Products
                    .where((p, { fns }) => fns.and(p.is_active.eq(1), p.stock.lte(5)))
                    .orderBy((p) => p.stock.asc())
                    .select("id", "name", "stock")
                    .all(),
            ]);

        const serviceRevenue = (
            await Promise.all(
                services.map(async (service) => {
                    const [row] = await prisma.query(
                        prisma.raw.sql`SELECT COALESCE(SUM(CAST(\`subtotal\` AS DECIMAL(20, 2))), 0) AS total, COUNT(*) AS n
                            FROM \`Service_order_item\` WHERE \`laundry_service_id\` = ${service.id}`
                            .returnsRow({ total: "mysql/text@1", n: "mysql/bigint@1" })
                            .build(),
                    );
                    const count = Number(row?.n ?? 0n);
                    return { service_name: service.name, total: money(row?.total ?? "0"), count };
                }),
            )
        )
            .filter((row) => row.count > 0)
            .sort((a, b) => Number(b.total) - Number(a.total));

        const weekly = new Map<string, Decimal>();
        for (let i = 0; i < 7; i++) {
            const d = dayStart(i);
            const key = d.toISOString().slice(0, 10);
            weekly.set(key, new Decimal(0));
        }
        for (const p of weeklyPayments) {
            if (!p.paid_at) continue;
            const key = p.paid_at.toISOString().slice(0, 10);
            if (weekly.has(key)) weekly.set(key, (weekly.get(key) ?? new Decimal(0)).plus(p.gross_amount));
        }

        return {
            orders_today: ordersToday,
            revenue_today: money(revenueToday),
            laundry_in_progress: inProgress,
            products_sold: productsSold,
            recent_orders: recentOrders.map((o) => {
                const svc = o.serviceOrderItems[0];
                const prod = o.productOrderItems[0];
                let summary = "Layanan laundry";
                if (svc && svc.service) {
                    const num = `${Number(svc.qty) % 1 === 0 ? Number(svc.qty).toFixed(0) : Number(svc.qty).toFixed(1)} ${svc.service.unit}`;
                    summary = `${svc.service.name} ${num}`;
                } else if (prod && prod.product) {
                    summary = `${prod.product.name} ${prod.qty} ${prod.product.size}`;
                }
                return {
                    order_id: o.order_id,
                    customer_name: o.user?.username ?? "",
                    customer_phone: o.user?.phone ?? "",
                    status: o.status,
                    total_amount: money(o.total_amount),
                    items_summary: summary,
                    created_at: o.created_at.toISOString(),
                };
            }),
            service_revenue: serviceRevenue,
            weekly_revenue: [...weekly.entries()]
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .map(([date, total]) => ({ date, total: money(total) })),
            low_stock_products: lowStock,
        };
    }
}
