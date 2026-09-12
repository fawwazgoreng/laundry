import { prisma } from "../../src/infrastructure/prisma/prisma";
import { logger } from "../../src/helper/logging/logger";

export async function resetTestDb(): Promise<void> {
    await prisma.$transaction([
        prisma.cash_flow.deleteMany({}),
        prisma.order_trackings.deleteMany({}),
        prisma.payments.deleteMany({}),
        prisma.product_order_item.deleteMany({}),
        prisma.service_order_item.deleteMany({}),
        prisma.orders.deleteMany({}),
        prisma.user_address.deleteMany({}),
        prisma.refresh_token.deleteMany({}),
        prisma.access_token.deleteMany({}),
        prisma.products.deleteMany({}),
        prisma.laundry_services.deleteMany({}),
        prisma.outlets.deleteMany({}),
        prisma.user.deleteMany({}),
    ]);

    const adminPassword = await Bun.password.hash("Admin@1234");
    const customerPassword = await Bun.password.hash("User@1234");

    const admin = await prisma.user.create({
        data: {
            username: "Admin Test",
            email: "test-admin@fadarosi.id",
            password: adminPassword,
            phone: "081234567890",
            role: "admin",
        },
    });
    const user = await prisma.user.create({
        data: {
            username: "Customer Test",
            email: "test-customer@fadarosi.id",
            password: customerPassword,
            phone: "081234567899",
            role: "user",
        },
    });

    await prisma.outlets.create({
        data: {
            id: 1,
            name: "Fadarosi Test Outlet",
            phone: "021-0000000",
            address_text: "Jl. Test No. 1, Jakarta",
            latitude: -6.2,
            longitude: 106.8,
            max_coverage_km: 10,
            min_order_amount: 0,
            weekly_hours: "Senin - Sabtu: 08:00-20:00 WIB",
        },
    });

    await prisma.laundry_services.createMany({
        data: [
            { name: "Cuci Kering", unit: "kg", price_per_unit: 4000, description: "test", estimated_duration_hours: 12, is_active: true },
            { name: "Cuci Setrika", unit: "kg", price_per_unit: 5000, description: "test", estimated_duration_hours: 24, is_active: true },
            { name: "Express", unit: "kg", price_per_unit: 6000, description: "test", estimated_duration_hours: 6, is_active: true },
        ],
    });

    await prisma.products.createMany({
        data: [
            { name: "Detergen Test", category: "Detergen", price: 25000, size: "500ml", stock: 10, is_active: true, image: "" },
            { name: "Softener Test", category: "Softener", price: 20000, size: "500ml", stock: 5, is_active: true, image: "" },
            { name: "Produk Sepi", category: "Detergen", price: 1000, size: "100ml", stock: 1, is_active: true, image: "" },
        ],
    });

    await prisma.user_address.create({
        data: {
            label: "Rumah Test",
            address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
            latitude: -6.2,
            longitude: 106.7,
            is_primary: true,
            user_id: user.id,
        },
    });

    logger.info("integration test database reset", { adminId: admin.id, userId: user.id });
}