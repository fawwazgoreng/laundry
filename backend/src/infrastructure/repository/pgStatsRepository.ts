import type { statsRepository } from "../../domain/repositories/statsRepository";
import type { adminStatsType } from "../../domain/types/adminType";
import { prisma } from "../prisma/prisma";

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

        const [ordersToday, revenueTodayAgg, inProgressAgg, productsSoldAgg, recentOrders, serviceItems, weeklyPayments, lowStock] =
            await Promise.all([
                prisma.orders.count({ where: { created_at: { gte: today } } }),
                prisma.payments.aggregate({
                    where: { status: "PAID", paid_at: { gte: today } },
                    _sum: { gross_amount: true },
                }),
                prisma.orders.count({
                    where: { status: { in: ["DITERIMA", "DIPROSES"] } },
                }),
                prisma.product_order_item.aggregate({
                    where: { order: { created_at: { gte: today } } },
                    _sum: { qty: true },
                }),
                prisma.orders.findMany({
                    take: 5,
                    orderBy: { created_at: "desc" },
                    include: { user: { select: { username: true } } },
                }),
                prisma.service_order_item.findMany({
                    include: { service: { select: { name: true } } },
                }),
                prisma.payments.findMany({
                    where: { status: "PAID", paid_at: { gte: dayStart(6) } },
                    select: { gross_amount: true, paid_at: true },
                }),
                prisma.products.findMany({
                    where: { is_active: true, stock: { lte: 5 } },
                    orderBy: { stock: "asc" },
                    select: { id: true, name: true, stock: true },
                }),
            ]);

        const revenueByService = new Map<string, { total: number; count: number }>();
        for (const item of serviceItems) {
            const name = item.service.name;
            const current = revenueByService.get(name) ?? { total: 0, count: 0 };
            current.total += Number(item.subtotal);
            current.count += 1;
            revenueByService.set(name, current);
        }

        const weekly = new Map<string, number>();
        for (let i = 0; i < 7; i++) {
            const d = dayStart(i);
            weekly.set(d.toISOString()?.slice(0, 10) ?? "", 0);
        }
        for (const p of weeklyPayments) {
            if (!p.paid_at) continue;
            const key = p.paid_at.toISOString()?.slice(0, 10) ?? "";
            if (weekly.has(key)) weekly.set(key, (weekly.get(key) ?? 0) + Number(p.gross_amount));
        }

        return {
            orders_today: ordersToday,
            revenue_today: Number(revenueTodayAgg._sum.gross_amount ?? 0),
            laundry_in_progress: inProgressAgg,
            products_sold: Number(productsSoldAgg._sum.qty ?? 0),
            recent_orders: recentOrders.map((o) => ({
                order_id: o.order_id,
                customer_name: o.user.username,
                status: o.status,
                total_amount: o.total_amount,
                created_at: o.created_at.toISOString(),
            })),
            service_revenue: [...revenueByService.entries()]
                .map(([service_name, v]) => ({ service_name, total: v.total, count: v.count }))
                .sort((a, b) => b.total - a.total),
            weekly_revenue: [...weekly.entries()]
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .map(([date, total]) => ({ date, total })),
            low_stock_products: lowStock,
        };
    }
}