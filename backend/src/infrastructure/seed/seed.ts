import { prisma } from "../prisma/prisma";
import { logger } from "../../helper/logging/logger";
import { orderEntity } from "../../domain/entities/orderEntity";
import { instant, numeric, varchar } from "../prisma/scalars";
import { addMoney, money, moneySum, multiplyMoney } from "../../lib/money";

function daysAgo(days: number, hour = 14): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return d;
}

async function seedServiceAddons(): Promise<void> {
    const groups = [
        {
            code: "detergen",
            name: "Detergen",
            selection_type: "single",
            is_required: false,
            sort_order: 1,
            options: [
                { name: "Standard", price: 1000, price_mode: "per_unit", sort_order: 1 },
                { name: "Premium", price: 2000, price_mode: "per_unit", sort_order: 2 },
                { name: "Hypoallergenic", price: 3500, price_mode: "per_unit", sort_order: 3 },
            ],
        },
        {
            code: "pewangi",
            name: "Pewangi",
            selection_type: "single",
            is_required: false,
            sort_order: 2,
            options: [
                { name: "Standard", price: 1000, price_mode: "per_unit", sort_order: 1 },
                { name: "Premium", price: 2500, price_mode: "per_unit", sort_order: 2 },
                { name: "Hypoallergenic", price: 4000, price_mode: "per_unit", sort_order: 3 },
            ],
        },
    ];

    for (const seed of groups) {
        let group = await prisma.orm.public.Service_addon_groups
            .where({ code: varchar<30>(seed.code) })
            .first();
        if (!group) {
            group = await prisma.orm.public.Service_addon_groups.create({
                code: varchar<30>(seed.code),
                name: varchar<50>(seed.name),
                selection_type: varchar<20>(seed.selection_type),
                is_required: seed.is_required,
                is_active: true,
            });
        } else {
            group = await prisma.orm.public.Service_addon_groups.where({ id: group.id }).update({
                name: varchar<50>(seed.name),
                selection_type: varchar<20>(seed.selection_type),
                is_required: seed.is_required,
                is_active: true,
            });
        }
        if (!group) throw new Error(`Gagal menyiapkan add-on ${seed.code}`);

        for (const option of seed.options) {
            const existing = await prisma.orm.public.Service_addon_options
                .where({ group_id: group.id, name: varchar<50>(option.name) })
                .first();
            if (!existing) {
                await prisma.orm.public.Service_addon_options.create({
                    group_id: group.id,
                    name: varchar<50>(option.name),
                    price: numeric<12, 2>(option.price),
                    price_mode: varchar<20>(option.price_mode),
                    is_default: false,
                    is_active: true,
                });
            } else {
                await prisma.orm.public.Service_addon_options.where({ id: existing.id }).update({
                    price: numeric<12, 2>(option.price),
                    price_mode: varchar<20>(option.price_mode),
                    is_active: true,
                });
            }
        }
    }

    const [services, addonGroups] = await Promise.all([
        prisma.orm.public.Laundry_services.all(),
        prisma.orm.public.Service_addon_groups.all(),
    ]);
    for (const service of services) {
        for (const group of addonGroups) {
            const existing = await prisma.orm.public.Laundry_service_addon_groups
                .where({ service_id: service.id, group_id: group.id })
                .first();
            if (!existing) {
                await prisma.orm.public.Laundry_service_addon_groups.create({
                    service_id: service.id,
                    group_id: group.id,
                });
            }
        }
    }
    logger.info("service addons ensured", { groups: addonGroups.length, services: services.length });
}

async function createDemoOrders(): Promise<void> {
    const { count } = await prisma.orm.public.Orders.aggregate((agg) => ({ count: agg.count() }));
    if (count > 0) return;

    const user = await prisma.orm.public.User.where({ email: "customer@fadarosi.id" }).first();
    const outlet = await prisma.orm.public.Outlets.where({ id: 1 }).first();
    const address = user
        ? await prisma.orm.public.User_address.where({ user_id: user.id, is_primary: true }).first()
        : null;
    const services = await prisma.orm.public.Laundry_services.orderBy((s) => s.id.asc()).all();
    const products = await prisma.orm.public.Products.orderBy((p) => p.id.asc()).all();
    if (!user || !outlet || !address || services.length < 4 || products.length < 6) return;

    const svc = (name: string) => services.find((s) => s.name === name)!;
    const prod = (name: string) => products.find((p) => p.name === name)!;
    const svcById = (id: number) => services.find((s) => s.id === id)!;
    const prodById = (id: number) => products.find((p) => p.id === id)!;
    const servicePrice = (id: number) => money(svcById(id).price_per_unit);
    const productPrice = (id: number) => money(prodById(id).price);

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

    for (const [index, d] of demo.entries()) {
        const laundrySubtotal = moneySum(d.services.map((s) => multiplyMoney(servicePrice(s.id), s.qty)));
        const productSubtotal = moneySum(d.products.map((p) => multiplyMoney(productPrice(p.id), p.qty)));
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

        const statusFlow =
            d.status === "BARU"
                ? ["BARU"]
                : d.status === "DIBATALKAN"
                  ? ["BARU", "DIBATALKAN"]
                  : ["BARU", "DITERIMA", d.status === "DITERIMA" ? "" : d.status].filter(Boolean);
        const trackings = statusFlow.map((st, i) => ({
            status: varchar<20>(st),
            notes:
                st === "BARU"
                    ? "Pesanan diterima. Menunggu konfirmasi outlet."
                    : st === "DITERIMA"
                      ? "Pakaian telah diterima staf di outlet."
                      : st === "DIBATALKAN"
                        ? "Pesanan dibatalkan."
                        : `Status pesanan diperbarui menjadi ${st}.`,
            estimated_completion_time: instant(createdAt),
            created_at: instant(new Date(createdAt.getTime() + i * 3600 * 1000)),
        }));

        const cashFlows: Array<{
            type: ReturnType<typeof varchar<20>>;
            category: ReturnType<typeof varchar<40>>;
            amount: ReturnType<typeof numeric<12, 2>>;
            description: string;
            created_at: Temporal.Instant;
        }> = [];
        if (d.paymentStatus === "PAID" && d.status !== "DIBATALKAN") {
            cashFlows.push({
                type: varchar<20>("income"),
                category: varchar<40>("sales"),
                amount: numeric<12, 2>(totals.total_amount),
                description: `Pembayaran ${d.paymentMethod} untuk order ${orderId}`,
                created_at: instant(createdAt),
            });
        }
        if (d.status === "DIBATALKAN") {
            cashFlows.push({
                type: varchar<20>("expense"),
                category: varchar<40>("refund"),
                amount: numeric<12, 2>(totals.total_amount),
                description: `Refund pembatalan order ${orderId} (${d.paymentMethod})`,
                created_at: instant(daysAgo(d.createdDaysAgo, 16)),
            });
        }

        const paymentType = d.paymentMethod === "transfer_bank" ? "transfer_bank" : d.paymentMethod;
        const VA = `2620${String(Math.floor(100000000000 + Math.random() * 899999999999))}`;

        await prisma.orm.public.Orders.create({
            order_id: orderId,
            user_id: user.id,
            outlet_id: outlet.id,
            user_address_id: address.id,
            distance_km: numeric<6, 2>(d.distanceKm),
            delivery_fee: numeric<10, 2>(deliveryFee),
            total_laundry: numeric<12, 2>(totals.total_laundry),
            total_product: numeric<12, 2>(totals.total_product),
            total_amount: numeric<12, 2>(totals.total_amount),
            status: varchar<20>(d.status),
            payment_method: varchar<20>(d.paymentMethod),
            notes: index === 0 ? "Tolong jemput setrikaan. Terima kasih." : null,
            created_at: instant(createdAt),
            serviceOrderItems: (items) =>
                items.create(
                    d.services.map((s) => ({
                        laundry_service_id: s.id,
                        qty: numeric<6, 2>(s.qty),
                        price_per_unit: numeric<12, 2>(servicePrice(s.id)),
                        addon_subtotal: numeric<12, 2>(0),
                        subtotal: numeric<12, 2>(multiplyMoney(servicePrice(s.id), s.qty)),
                        notes: "",
                    })),
                ),
            productOrderItems: (items) =>
                items.create(
                    d.products.map((p) => ({
                        product_id: p.id,
                        qty: p.qty,
                        subtotal: numeric<12, 2>(multiplyMoney(productPrice(p.id), p.qty)),
                    })),
                ),
            orderTrackings: (t) => t.create(trackings),
            payments: (p) =>
                p.create({
                    transaction_id: d.paymentMethod === "transfer_bank" ? VA : `FDP-${orderId}`,
                    payment_type: varchar<20>(paymentType),
                    gross_amount: numeric<12, 2>(totals.total_amount),
                    status: varchar<30>(d.paymentStatus),
                    paid_at: d.paymentStatus === "PAID" ? instant(createdAt) : null,
                    raw_response: (d.paymentStatus === "PAID"
                        ? d.paymentMethod === "fadarosipay"
                            ? { gateway: "fadarosipay", method: "wallet" }
                            : { gateway: "cod", paidOnDelivery: true }
                        : null) as never,
                    created_at: instant(createdAt),
                }),
            ...(cashFlows.length > 0 ? { cashFlows: (c) => c.create(cashFlows) } : {}),
        });

        for (const p of d.products) {
            const product = prodById(p.id);
            await prisma.orm.public.Products.where({ id: p.id }).update({ stock: product.stock - p.qty });
        }
    }

    logger.info("demo orders seeded", { count: demo.length });
}

async function main() {
    const adminPassword = await Bun.password.hash("Admin@1234");
    const userPassword = await Bun.password.hash("User@1234");

    let admin = await prisma.orm.public.User.where({ email: "admin@fadarosi.id" }).first();
    if (!admin) {
        admin = await prisma.orm.public.User.create({
            username: varchar("Budi"),
            email: "admin@fadarosi.id",
            password: adminPassword,
            phone: varchar("081234567890"),
            role: varchar("admin"),
        });
    }
    logger.info("admin ensured", { userId: admin.id });

    let user = await prisma.orm.public.User.where({ email: "customer@fadarosi.id" }).first();
    if (!user) {
        user = await prisma.orm.public.User.create({
            username: varchar("Budi Hartono"),
            email: "customer@fadarosi.id",
            password: userPassword,
            phone: varchar("08123456789"),
            role: varchar("user"),
        });
    }
    logger.info("customer ensured", { userId: user.id });

    let outlet = await prisma.orm.public.Outlets.where({ id: 1 }).first();
    if (!outlet) {
        outlet = await prisma.orm.public.Outlets.create({
            id: 1,
            name: "Fadarosi Premium Jakarta",
            phone: varchar("021-8273912"),
            address_text: "Jl. Boulevard Raya Barat Blok AD No. 12, Kelapa Gading, Jakarta Utara",
            latitude: numeric<10, 8>(-6.1604),
            longitude: numeric<11, 8>(106.9047),
            max_coverage_km: numeric<5, 2>(5.0),
            min_order_amount: numeric<12, 2>(50000),
            weekly_hours: "Senin - Jumat: 08:00-20:00 WIB\nSabtu: 08:00-18:00 WIB\nMinggu: Tutup",
        });
    }
    logger.info("outlet ensured", { outletId: outlet.id });

    const services = [
        { name: "Cuci Kering", unit: "kg", price_per_unit: 4000, description: "Dicuci bersih dan dikeringkan mesin. Tanpa setrika.", estimated_duration_hours: 12 },
        { name: "Cuci Setrika", unit: "kg", price_per_unit: 5000, description: "Dicuci bersih, dikeringkan mesin dan disetrika dengan rapi.", estimated_duration_hours: 24 },
        { name: "Express", unit: "kg", price_per_unit: 6000, description: "Layanan cuci, kering setrika serba cepat. Selesai dalam 6 jam.", estimated_duration_hours: 6 },
        { name: "Setrika Saja", unit: "kg", price_per_unit: 4000, description: "Pakaian sudah bersih dari rumah, kami setrika & lipat rapi.", estimated_duration_hours: 6 },
    ];
    const { count: serviceCount } = await prisma.orm.public.Laundry_services.aggregate((agg) => ({ count: agg.count() }));
    if (serviceCount === 0) {
        for (const s of services) {
            await prisma.orm.public.Laundry_services.create({
                name: varchar(s.name),
                unit: varchar(s.unit),
                price_per_unit: numeric<12, 2>(s.price_per_unit),
                description: s.description,
                estimated_duration_hours: s.estimated_duration_hours,
                is_active: true,
            });
        }
    }
    logger.info("services ensured", { count: services.length });

    await seedServiceAddons();

    const { count: productCount } = await prisma.orm.public.Products.aggregate((agg) => ({ count: agg.count() }));
    if (productCount === 0) {
        const productSeeds = [
            { name: "Detergen Cair Liquid Pro", category: "Detergen", price: 32500, size: "1L", stock: 24, is_active: true, image: "" },
            { name: "Softener Lavender Blossom", category: "Softener", price: 28000, size: "800ml", stock: 18, is_active: true, image: "" },
            { name: "Pewangi Semprot Jasmine", category: "Pewangi", price: 18500, size: "250ml", stock: 45, is_active: true, image: "" },
            { name: "Pemutih OxiBright", category: "Pemutih", price: 15000, size: "500ml", stock: 12, is_active: true, image: "" },
            { name: "Minyak Goreng Refill", category: "Minyak Goreng", price: 22000, size: "1L", stock: 50, is_active: true, image: "" },
            { name: "Paket Hemat Cuci Bersih", category: "Paket Hemat", price: 65000, size: "set", stock: 8, is_active: true, image: "" },
            { name: "Detergen Premium Lavender", category: "Detergen", price: 45000, size: "1.5L", stock: 2, is_active: true, image: "" },
            { name: "Softener Anti Kusut Fresh", category: "Softener", price: 35000, size: "900ml", stock: 0, is_active: true, image: "" },
            { name: "Pewangi Semprot Lemon", category: "Pewangi", price: 19500, size: "250ml", stock: 5, is_active: true, image: "" },
        ];
        for (const p of productSeeds) {
            await prisma.orm.public.Products.create({
                name: varchar(p.name),
                category: varchar(p.category),
                price: numeric<12, 2>(p.price),
                size: varchar(p.size),
                stock: p.stock,
                is_active: p.is_active,
                image: p.image,
            });
        }
        logger.info("products seeded", { count: productSeeds.length });
    }

    let primaryAddress = await prisma.orm.public.User_address.where({ id: 1 }).first();
    if (!primaryAddress) {
        primaryAddress = await prisma.orm.public.User_address.create({
            id: 1,
            label: varchar("Rumah Utama"),
            address_text: "Jl. Kebon Jeruk No. 12, Kel. Palmerah, Kec. Palmerah, Jakarta Barat, DKI Jakarta, 11530",
            latitude: numeric<10, 8>(-6.2001),
            longitude: numeric<11, 8>(106.7839),
            is_primary: true,
            user_id: user.id,
        });
    }
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
        await prisma.close();
    });
