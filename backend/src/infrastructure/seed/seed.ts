import { prisma } from "../prisma/prisma";
import { logger } from "../../helper/logging/logger";

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