import { prisma } from "../prisma/prisma";
import { logger } from "../../helper/logging/logger";
import { orderEntity } from "../../domain/entities/orderEntity";
import type { Prisma } from "../src/generated/prisma/client";

function daysAgo(days: number, hour = 14): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return d;
}

function futureHours(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function createDemoOrders(): Promise<void> {
    if ((await prisma.orders.count()) > 0) return;

    const user = await prisma.user.findUnique({ where: { email: "customer@fadarosi.id" } });
    const outlet = await prisma.outlets.findUnique({ where: { id: 1 } });
    const address = await prisma.user_address.findFirst({ where: { user_id: user?.id, is_primary: true } });
    const services = await prisma.laundry_services.findMany({ orderBy: { id: "asc" } });
    const products = await prisma.products.findMany({ orderBy: { id: "asc" } });
    if (!user || !outlet || !address || services.length < 4 || products.length < 6) return;

    const svc = (name: string) => services.find((s) => s.name === name)!;
    const prod = (name: string) => products.find((p) => p.name === name)!;
    const svcById = (id: number) => services.find((s) => s.id === id)!;
    const prodById = (id: number) => products.find((p) => p.id === id)!;
    const servicePrice = (id: number) => Number(svcById(id).price_per_unit);
    const productPrice = (id: number) => Number(prodById(id).price);

    const demo = [
        {
            status: "BARU",
            createdDaysAgo: 0,
            distanceKm: 2.5,
            services: [
                { id: svc("Cuci Setrika").id, qty: 3 },
                { id: svc("Setrika Saja").id, qty: 2 },
            ],
            products: [] as Array<{ id: number; qty: number }>,
            paymentMethod: "transfer_bank" as const,
            paymentStatus: "PENDING" as const,
        },
        {
            status: "DITERIMA",
            createdDaysAgo: 1,
            distanceKm: 1.2,
            services: [{ id: svc("Cuci Kering").id, qty: 2 }],
            products: [],
            paymentMethod: "transfer_bank" as const,
            paymentStatus: "PENDING" as const,
        },
        {
            status: "DIPROSES",
            createdDaysAgo: 2,
            distanceKm: 3,
            services: [{ id: svc("Express").id, qty: 5 }],
            products: [
                { id: prod("Detergen Cair Liquid Pro").id, qty: 1 },
                { id: prod("Softener Lavender Blossom").id, qty: 1 },
            ],
            paymentMethod: "fadarosipay" as const,
            paymentStatus: "PAID" as const,
        },
        {
            status: "SIAP_ANTAR",
            createdDaysAgo: 3,
            distanceKm: 1,
            services: [{ id: svc("Cuci Setrika").id, qty: 4 }],
            products: [],
            paymentMethod: "cod" as const,
            paymentStatus: "PENDING" as const,
        },
        {
            status: "SELESAI",
            createdDaysAgo: 4,
            distanceKm: 1.5,
            services: [{ id: svc("Cuci Kering").id, qty: 6 }],
            products: [{ id: prod("Pewangi Semprot Jasmine").id, qty: 1 }],
            paymentMethod: "cod" as const,
            paymentStatus: "PAID" as const,
        },
        {
            status: "DIBATALKAN",
            createdDaysAgo: 5,
            distanceKm: 2,
            services: [{ id: svc("Express").id, qty: 2 }],
            products: [],
            paymentMethod: "fadarosipay" as const,
            paymentStatus: "PAID" as const,
        },
    ];

    const orderItems: Prisma.OrdersCreateManyInput[] = [];
    const trackings: Prisma.Order_trackingsCreateManyInput[] = [];
    const payments: Prisma.PaymentsCreateManyInput[] = [];
    const cashFlows: Prisma.Cash_flowCreateManyInput[] = [];

    for (const [index, d] of demo.entries()) {
        const laundrySubtotal = d.services.reduce((sum, s) => sum + servicePrice(s.id) * s.qty, 0);
        const productSubtotal = d.products.reduce((sum, p) => sum + productPrice(p.id) * p.qty, 0);
        const deliveryFee = orderEntity.computeDeliveryFee(d.distanceKm);
        const totals = orderEntity.computeTotals({
            laundrySubtotal,
            productSubtotal,
            itemCount: d.services.length + d.products.length,
            deliveryFee,
        });
        const seq = index + 1;
        const orderId = orderEntity.generateOrderId(seq, daysAgo(d.createdDaysAgo));
        const createdAt = daysAgo(d.createdDaysAgo, 14);

        orderItems.push({
            order_id: orderId,
            user_id: user.id,
            outlet_id: outlet.id,
            user_address_id: address.id,
            distance_km: d.distanceKm,
            delivery_fee: deliveryFee,
            total_laundry: totals.total_laundry,
            total_product: totals.total_product,
            total_amount: totals.total_amount,
            status: d.status,
            payment_method: d.paymentMethod,
            notes: index === 0 ? "Tolong jemput setrikaan. Terima kasih." : null,
            created_at: createdAt,
        });

        const paymentType = d.paymentMethod === "transfer_bank" ? "transfer_bank" : d.paymentMethod;
        const VA = `2620${String(Math.floor(100000000000 + Math.random() * 899999999999))}`;
        payments.push({
            order_id: orderId,
            transaction_id: d.paymentMethod === "transfer_bank" ? VA : `FDP-${orderId}`,
            payment_type: paymentType,
            gross_amount: totals.total_amount,
            status: d.paymentStatus,
            paid_at: d.paymentStatus === "PAID" ? createdAt : null,
            raw_response:
                d.paymentStatus === "PAID"
                    ? d.paymentMethod === "fadarosipay"
                        ? { gateway: "fadarosipay", method: "wallet" }
                        : { gateway: "cod", paidOnDelivery: true }
                    : undefined,
            created_at: createdAt,
        });

        if (d.paymentStatus === "PAID" && d.status !== "DIBATALKAN") {
            cashFlows.push({
                order_id: orderId,
                type: "income",
                category: "sales",
                amount: totals.total_amount,
                description: `Pembayaran ${d.paymentMethod} untuk order ${orderId}`,
                created_at: createdAt,
            });
        }
        if (d.status === "DIBATALKAN") {
            cashFlows.push({
                order_id: orderId,
                type: "expense",
                category: "refund",
                amount: totals.total_amount,
                description: `Refund pembatalan order ${orderId} (${d.paymentMethod})`,
                created_at: daysAgo(d.createdDaysAgo, 16),
            });
        }

        const statusFlow =
            d.status === "BARU"
                ? ["BARU"]
                : d.status === "DIBATALKAN"
                  ? ["BARU", "DIBATALKAN"]
                  : ["BARU", "DITERIMA", d.status === "DITERIMA" ? "" : d.status].filter(Boolean);
        statusFlow.forEach((st, i) => {
            trackings.push({
                order_id: orderId,
                status: st,
                notes:
                    st === "BARU"
                        ? "Pesanan diterima. Menunggu konfirmasi outlet."
                        : st === "DITERIMA"
                          ? "Pakaian telah diterima staf di outlet."
                          : st === "DIBATALKAN"
                            ? "Pesanan dibatalkan."
                            : `Status pesanan diperbarui menjadi ${st}.`,
                estimated_completion_time: createdAt,
                created_at: new Date(createdAt.getTime() + i * 3600 * 1000),
            });
        });
    }

    await prisma.orders.createMany({ data: orderItems });
    for (const [index, d] of demo.entries()) {
        const orderIdFor = (i: number) => orderEntity.generateOrderId(i + 1, daysAgo(demo[i].createdDaysAgo));
        for (const s of d.services) {
            await prisma.service_order_item.create({
                data: {
                    order_id: orderIdFor(index),
                    laundry_service_id: s.id,
                    qty: s.qty,
                    subtotal: servicePrice(s.id) * s.qty,
                    notes: "",
                },
            });
        }
        for (const p of d.products) {
            await prisma.product_order_item.create({
                data: {
                    order_id: orderIdFor(index),
                    product_id: p.id,
                    qty: p.qty,
                    subtotal: productPrice(p.id) * p.qty,
                },
            });
            await prisma.products.update({
                where: { id: p.id },
                data: { stock: { decrement: p.qty } },
            });
        }
    }
    await prisma.order_trackings.createMany({ data: trackings });
    await prisma.payments.createMany({ data: payments });
    await prisma.cash_flow.createMany({ data: cashFlows });
    logger.info("demo orders seeded", { count: demo.length });
}

async function main() {
    const adminPassword = await Bun.password.hash("Admin@1234");
    const userPassword = await Bun.password.hash("User@1234");

    const admin = await prisma.user.upsert({
        where: { email: "admin@fadarosi.id" },
        update: {},
        create: {
            username: "Budi",
            email: "admin@fadarosi.id",
            password: adminPassword,
            phone: "081234567890",
            role: "admin",
        },
    });
    logger.info("admin ensured", { userId: admin.id });

    const user = await prisma.user.upsert({
        where: { email: "customer@fadarosi.id" },
        update: {},
        create: {
            username: "Budi Hartono",
            email: "customer@fadarosi.id",
            password: userPassword,
            phone: "08123456789",
            role: "user",
        },
    });
    logger.info("customer ensured", { userId: user.id });

    const outlet = await prisma.outlets.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: "Fadarosi Premium Jakarta",
            phone: "021-8273912",
            address_text: "Jl. Boulevard Raya Barat Blok AD No. 12, Kelapa Gading, Jakarta Utara",
            latitude: -6.1604,
            longitude: 106.9047,
            max_coverage_km: 5.0,
            min_order_amount: 50000,
            weekly_hours: "Senin - Jumat: 08:00-20:00 WIB\nSabtu: 08:00-18:00 WIB\nMinggu: Tutup",
        },
    });
    logger.info("outlet ensured", { outletId: outlet.id });

    const services = [
        { name: "Cuci Kering", unit: "kg", price_per_unit: 4000, description: "Dicuci bersih dan dikeringkan mesin. Tanpa setrika.", estimated_duration_hours: 12 },
        { name: "Cuci Setrika", unit: "kg", price_per_unit: 5000, description: "Dicuci bersih, dikeringkan mesin dan disetrika dengan rapi.", estimated_duration_hours: 24 },
        { name: "Express", unit: "kg", price_per_unit: 6000, description: "Layanan cuci, kering setrika serba cepat. Selesai dalam 6 jam.", estimated_duration_hours: 6 },
        { name: "Setrika Saja", unit: "kg", price_per_unit: 4000, description: "Pakaian sudah bersih dari rumah, kami setrika & lipat rapi.", estimated_duration_hours: 6 },
    ];
    if ((await prisma.laundry_services.count()) === 0) {
        await prisma.laundry_services.createMany({
            data: services.map((s) => ({ ...s, is_active: true })),
        });
    }
    logger.info("services ensured", { count: services.length });

    const existing = await prisma.products.count();
    if (existing === 0) {
        await prisma.products.createMany({
            data: [
                { name: "Detergen Cair Liquid Pro", category: "Detergen", price: 32500, size: "1L", stock: 24, is_active: true, image: "" },
                { name: "Softener Lavender Blossom", category: "Softener", price: 28000, size: "800ml", stock: 18, is_active: true, image: "" },
                { name: "Pewangi Semprot Jasmine", category: "Pewangi", price: 18500, size: "250ml", stock: 45, is_active: true, image: "" },
                { name: "Pemutih OxiBright", category: "Pemutih", price: 15000, size: "500ml", stock: 12, is_active: true, image: "" },
                { name: "Minyak Goreng Refill", category: "Minyak Goreng", price: 22000, size: "1L", stock: 50, is_active: true, image: "" },
                { name: "Paket Hemat Cuci Bersih", category: "Paket Hemat", price: 65000, size: "set", stock: 8, is_active: true, image: "" },
                { name: "Detergen Premium Lavender", category: "Detergen", price: 45000, size: "1.5L", stock: 2, is_active: true, image: "" },
                { name: "Softener Anti Kusut Fresh", category: "Softener", price: 35000, size: "900ml", stock: 0, is_active: true, image: "" },
                { name: "Pewangi Semprot Lemon", category: "Pewangi", price: 19500, size: "250ml", stock: 5, is_active: true, image: "" },
            ],
        });
        logger.info("products seeded", { count: 9 });
    }

    const primaryAddress = await prisma.user_address.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            label: "Rumah Utama",
            address_text: "Jl. Kebon Jeruk No. 12, Kel. Palmerah, Kec. Palmerah, Jakarta Barat, DKI Jakarta, 11530",
            latitude: -6.2001,
            longitude: 106.7839,
            is_primary: true,
            user_id: user.id,
        },
    });
    logger.info("primary address ensured", { addressId: primaryAddress.id });

    await createDemoOrders();

    logger.info("seed finished");
}

main()
    .catch((error) => {
        logger.error("seed failed", { message: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });