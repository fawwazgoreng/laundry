import { prisma } from "../../src/infrastructure/prisma/prisma";
import { logger } from "../../src/helper/logging/logger";
import { numeric, varchar } from "../../src/infrastructure/prisma/scalars";

export async function resetTestDb(): Promise<void> {
    await prisma.orm.public.Cash_flow.where({}).deleteAll();
    await prisma.orm.public.Order_trackings.where({}).deleteAll();
    await prisma.orm.public.Payments.where({}).deleteAll();
    await prisma.orm.public.Product_order_item.where({}).deleteAll();
    await prisma.orm.public.Service_order_item.where({}).deleteAll();
    await prisma.orm.public.Orders.where({}).deleteAll();
    await prisma.orm.public.User_address.where({}).deleteAll();
    await prisma.orm.public.Refresh_token.where({}).deleteAll();
    await prisma.orm.public.Access_token.where({}).deleteAll();
    await prisma.orm.public.Products.where({}).deleteAll();
    await prisma.orm.public.Laundry_services.where({}).deleteAll();
    await prisma.orm.public.Outlets.where({}).deleteAll();
    await prisma.orm.public.User.where({}).deleteAll();

    const adminPassword = await Bun.password.hash("Admin@1234");
    const customerPassword = await Bun.password.hash("User@1234");

    const admin = await prisma.orm.public.User.create({
        username: varchar("Admin Test"),
        email: "test-admin@fadarosi.id",
        password: adminPassword,
        phone: varchar("081234567890"),
        role: varchar("admin"),
    });
    const user = await prisma.orm.public.User.create({
        username: varchar("Customer Test"),
        email: "test-customer@fadarosi.id",
        password: customerPassword,
        phone: varchar("081234567899"),
        role: varchar("user"),
    });

    await prisma.orm.public.Outlets.create({
        id: 1,
        name: "Fadarosi Test Outlet",
        phone: varchar("021-0000000"),
        address_text: "Jl. Test No. 1, Jakarta",
        latitude: numeric<10, 8>(-6.2),
        longitude: numeric<11, 8>(106.8),
        max_coverage_km: numeric<5, 2>(10),
        min_order_amount: numeric<12, 2>(0),
        weekly_hours: "Senin - Sabtu: 08:00-20:00 WIB",
    });

    const services = [
        { name: "Cuci Kering", unit: "kg", price_per_unit: 4000, description: "test", estimated_duration_hours: 12, is_active: true },
        { name: "Cuci Setrika", unit: "kg", price_per_unit: 5000, description: "test", estimated_duration_hours: 24, is_active: true },
        { name: "Express", unit: "kg", price_per_unit: 6000, description: "test", estimated_duration_hours: 6, is_active: true },
    ];
    for (const s of services) {
        await prisma.orm.public.Laundry_services.create({
            name: varchar(s.name),
            unit: varchar(s.unit),
            price_per_unit: numeric<12, 2>(s.price_per_unit),
            description: s.description,
            estimated_duration_hours: s.estimated_duration_hours,
            is_active: s.is_active,
        });
    }

    const products = [
        { name: "Detergen Test", category: "Detergen", price: 25000, size: "500ml", stock: 10, is_active: true, image: "" },
        { name: "Softener Test", category: "Softener", price: 20000, size: "500ml", stock: 5, is_active: true, image: "" },
        { name: "Produk Sepi", category: "Detergen", price: 1000, size: "100ml", stock: 1, is_active: true, image: "" },
    ];
    for (const p of products) {
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

    await prisma.orm.public.User_address.create({
        label: varchar("Rumah Test"),
        address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
        latitude: numeric<10, 8>(-6.2),
        longitude: numeric<11, 8>(106.7),
        is_primary: true,
        user_id: user.id,
    });

    logger.info("integration test database reset", { adminId: admin.id, userId: user.id });
}
