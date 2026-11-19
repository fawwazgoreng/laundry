import { prisma } from "../prisma/prisma";
import { logger } from "../../helper/logging/logger";
import { orderEntity } from "../../domain/entities/orderEntity";
import { instant, numeric, varchar } from "../prisma/scalars";
import { money, moneySum, multiplyMoney } from "../../lib/money";

type OrderStatus = "BARU" | "DITERIMA" | "DIPROSES" | "SIAP_ANTAR" | "SELESAI" | "DIBATALKAN";
/** transfer_bank = payment gateway (virtual account); cod = bayar di tempat (BUKAN gateway). */
type PaymentMethod = "transfer_bank" | "cod";
type PaymentStatus = "PENDING" | "PAID";
type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";
/** per_unit = dikali qty item; per_order = dikenakan sekali per item order. */
type PriceMode = "per_unit" | "per_order";
type SelectionType = "single" | "multiple";

const ORDER_PIPELINE: readonly OrderStatus[] = ["BARU", "DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI"];
const HOUR_MS = 3_600_000;

interface AddonOptionSeed {
    name: string;
    price: number;
    price_mode: PriceMode;
}

interface AddonGroupSeed {
    code: string;
    name: string;
    selection_type: SelectionType;
    is_required: boolean;
    options: readonly AddonOptionSeed[];
}

interface AddonPick {
    group: string;
    option: string;
}

interface DemoServiceLine {
    name: string;
    qty: number;
    addons?: readonly AddonPick[];
}

interface DemoProductLine {
    name: string;
    qty: number;
    addons?: readonly AddonPick[];
}

interface DemoRefund {
    status: RefundStatus;
    reason: string;
    /** Jam setelah order dibuat/dibayar saat refund diajukan. */
    requestedAfterHours: number;
    /** Terisi hanya jika refund sudah diproses admin (selain REQUESTED). */
    processedAfterHours?: number;
    /** Catatan admin (dipakai pada REJECTED). */
    note?: string;
}

interface DemoOrder {
    label: string;
    status: OrderStatus;
    createdDaysAgo: number;
    distanceKm: number;
    services: readonly DemoServiceLine[];
    products: readonly DemoProductLine[];
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    notes?: string;
    refund?: DemoRefund;
}

interface CashFlowSeed {
    type: ReturnType<typeof varchar<20>>;
    category: ReturnType<typeof varchar<40>>;
    amount: ReturnType<typeof numeric<12, 2>>;
    description: string;
    created_at: Temporal.Instant;
}

/* ---------- Utilitas ---------- */

function daysAgo(days: number, hour = 14): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return d;
}

function hoursAfter(base: Date, hours: number): Date {
    return new Date(base.getTime() + hours * HOUR_MS);
}

function required<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) throw new Error(message);
    return value;
}

/* ==========================================================================
 * 1. KATALOG ADD-ON
 * ========================================================================== */

const SERVICE_ADDON_GROUPS: readonly AddonGroupSeed[] = [
    {
        code: "detergen",
        name: "Detergen",
        selection_type: "single",
        is_required: true,
        options: [
            { name: "Standard", price: 0, price_mode: "per_unit" },
            { name: "Premium", price: 1000, price_mode: "per_unit" },
            { name: "Hypoallergenic", price: 1500, price_mode: "per_unit" },
        ],
    },
    {
        code: "pewangi",
        name: "Pewangi",
        selection_type: "single",
        is_required: true,
        options: [
            { name: "Standard", price: 0, price_mode: "per_unit" },
            { name: "Sakura", price: 1000, price_mode: "per_unit" },
            { name: "Lavender", price: 1000, price_mode: "per_unit" },
            { name: "Peach", price: 1000, price_mode: "per_unit" },
            { name: "Plum", price: 1000, price_mode: "per_unit" },
        ],
    },
];

const PRODUCT_ADDON_GROUPS: readonly AddonGroupSeed[] = [
    {
        code: "kemasan",
        name: "Kemasan",
        selection_type: "single",
        is_required: false,
        options: [
            { name: "Bubble Wrap", price: 2000, price_mode: "per_order" },
            { name: "Kardus Tambahan", price: 3000, price_mode: "per_order" },
            { name: "Gift Wrap", price: 5000, price_mode: "per_order" },
        ],
    },
    {
        code: "ekstra",
        name: "Ekstra",
        selection_type: "multiple",
        is_required: false,
        options: [
            { name: "Kartu Ucapan", price: 2000, price_mode: "per_order" },
            { name: "Label Nama", price: 1500, price_mode: "per_order" },
        ],
    },
];

/** Grup add-on produk per kategori. Kategori tanpa entri memakai DEFAULT. */
const DEFAULT_PRODUCT_ADDON_CODES: readonly string[] = ["kemasan"];
const PRODUCT_ADDON_CODES_BY_CATEGORY: Readonly<Record<string, readonly string[]>> = {
    Pemutih: [], // contoh produk tanpa add-on
    Pewangi: ["kemasan", "ekstra"],
    Aksesoris: ["kemasan", "ekstra"],
};

function addonCodesForProduct(category: string): readonly string[] {
    return PRODUCT_ADDON_CODES_BY_CATEGORY[category] ?? DEFAULT_PRODUCT_ADDON_CODES;
}

async function upsertAddonGroup(seed: AddonGroupSeed): Promise<void> {
    const fields = {
        name: varchar<50>(seed.name),
        selection_type: varchar<20>(seed.selection_type),
        is_required: seed.is_required,
        is_active: true,
    };
    const existing = await prisma.orm.public.Service_addon_groups
        .where({ code: varchar<30>(seed.code) })
        .first();
    const group = existing
        ? await prisma.orm.public.Service_addon_groups.where({ id: existing.id }).update(fields)
        : await prisma.orm.public.Service_addon_groups.create({ code: varchar<30>(seed.code), ...fields });
    if (!group) throw new Error(`Gagal menyiapkan add-on ${seed.code}`);

    for (const option of seed.options) {
        const found = await prisma.orm.public.Service_addon_options
            .where({ group_id: group.id, name: varchar<50>(option.name) })
            .first();
        if (!found) {
            await prisma.orm.public.Service_addon_options.create({
                group_id: group.id,
                name: varchar<50>(option.name),
                price: numeric<12, 2>(option.price),
                price_mode: varchar<20>(option.price_mode),
                is_default: false,
                is_active: true,
            });
        } else {
            await prisma.orm.public.Service_addon_options.where({ id: found.id }).update({
                price: numeric<12, 2>(option.price),
                price_mode: varchar<20>(option.price_mode),
                is_active: true,
            });
        }
    }
}

async function seedAddonCatalog(): Promise<void> {
    for (const seed of [...SERVICE_ADDON_GROUPS, ...PRODUCT_ADDON_GROUPS]) {
        await upsertAddonGroup(seed);
    }
    logger.info("addon catalog ensured", {
        serviceGroups: SERVICE_ADDON_GROUPS.length,
        productGroups: PRODUCT_ADDON_GROUPS.length,
    });
}

/** Menautkan grup add-on layanan ke semua layanan laundry (hanya grup layanan). */
async function linkServiceAddonGroups(): Promise<void> {
    const codes = new Set<string>(SERVICE_ADDON_GROUPS.map((g) => g.code));
    const [services, allGroups] = await Promise.all([
        prisma.orm.public.Laundry_services.all(),
        prisma.orm.public.Service_addon_groups.all(),
    ]);
    const groups = allGroups.filter((g) => codes.has(g.code));

    for (const service of services) {
        for (const group of groups) {
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
    logger.info("service addon links ensured", { services: services.length, groups: groups.length });
}

/** Menautkan grup add-on produk ke setiap produk sesuai kategori. */
async function linkProductAddonGroups(): Promise<void> {
    const [products, allGroups] = await Promise.all([
        prisma.orm.public.Products.all(),
        prisma.orm.public.Service_addon_groups.all(),
    ]);
    const groupByCode = new Map<string, (typeof allGroups)[number]>(allGroups.map((g) => [g.code, g] as const));

    let links = 0;
    for (const product of products) {
        for (const code of addonCodesForProduct(String(product.category))) {
            const group = required(groupByCode.get(code), `Grup add-on produk "${code}" belum tersedia`);
            const existing = await prisma.orm.public.Product_addon_groups
                .where({ product_id: product.id, group_id: group.id })
                .first();
            if (!existing) {
                await prisma.orm.public.Product_addon_groups.create({
                    product_id: product.id,
                    group_id: group.id,
                });
            }
            links += 1;
        }
    }
    logger.info("product addon links ensured", { products: products.length, links });
}

/* ==========================================================================
 * 2. DATA DEMO ORDER
 *    #1-#6  : kasus asli (pembayaran gateway kini memakai transfer_bank)
 *    #7-#18 : kasus baru (add-on layanan/produk, refund multi-kondisi)
 *
 *    Catatan: sengaja TIDAK ada kasus tepat di batas 7 hari karena hasilnya
 *    bergantung jam eksekusi seed. Boundary diuji di unit test dengan clock
 *    yang di-inject.
 * ========================================================================== */

const DEMO_ORDERS: readonly DemoOrder[] = [
    // ---- Kasus asli ----
    {
        label: "baru-layanan-transfer-pending",
        status: "BARU",
        createdDaysAgo: 0,
        distanceKm: 2.5,
        services: [
            { name: "Cuci Setrika", qty: 3 },
            { name: "Setrika Saja", qty: 2 },
        ],
        products: [],
        paymentMethod: "transfer_bank",
        paymentStatus: "PENDING",
        notes: "Tolong jemput setrikaan. Terima kasih.",
    },
    {
        label: "diterima-layanan-transfer-pending",
        status: "DITERIMA",
        createdDaysAgo: 1,
        distanceKm: 1.2,
        services: [{ name: "Cuci Kering", qty: 2 }],
        products: [],
        paymentMethod: "transfer_bank",
        paymentStatus: "PENDING",
    },
    {
        // Sedang diproses, produk ada, gateway lunas -> ORDER_STATUS_INVALID.
        label: "diproses-campuran-gateway-lunas",
        status: "DIPROSES",
        createdDaysAgo: 2,
        distanceKm: 3,
        services: [{ name: "Express", qty: 5 }],
        products: [
            { name: "Detergen Cair Buketan 1L", qty: 1 },
            { name: "Softener Downy Refill 650ml", qty: 1 },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
    {
        label: "siap-antar-layanan-cod",
        status: "SIAP_ANTAR",
        createdDaysAgo: 3,
        distanceKm: 1,
        services: [{ name: "Cuci Setrika", qty: 4 }],
        products: [],
        paymentMethod: "cod",
        paymentStatus: "PENDING",
    },
    {
        label: "selesai-campuran-cod-lunas",
        status: "SELESAI",
        createdDaysAgo: 4,
        distanceKm: 1.5,
        services: [{ name: "Cuci Kering", qty: 6 }],
        products: [{ name: "Parfum Snappy 250ml", qty: 1 }],
        paymentMethod: "cod",
        paymentStatus: "PAID",
    },
    {
        // Dibatalkan setelah dibayar via gateway -> income + expense refund.
        label: "batal-layanan-gateway-lunas",
        status: "DIBATALKAN",
        createdDaysAgo: 5,
        distanceKm: 2,
        services: [{ name: "Express", qty: 2 }],
        products: [],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },

    // ---- Kasus baru ----
    {
        // Memenuhi SEMUA syarat refund; belum ada refund request (tombol aktif).
        // Buketan & Vanish punya add-on kemasan, Bayclin (Pemutih) tanpa add-on.
        label: "refund-eligible-produk-gateway",
        status: "SELESAI",
        createdDaysAgo: 2,
        distanceKm: 2,
        services: [],
        products: [
            { name: "Detergen Cair Buketan 1L", qty: 2, addons: [{ group: "kemasan", option: "Kardus Tambahan" }] },
            { name: "Bayclin Pemutih Pakaian 500ml", qty: 1 },
            { name: "Vanish Oxi Action Liquid 450ml", qty: 1, addons: [{ group: "kemasan", option: "Bubble Wrap" }] },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
    {
        // Refund via transfer bank (VA), status REQUESTED. Add-on kemasan + 2 ekstra (per_order).
        label: "refund-diajukan-transfer-va",
        status: "SELESAI",
        createdDaysAgo: 3,
        distanceKm: 1,
        services: [],
        products: [
            {
                name: "Hanger Stainless (Isi 10)",
                qty: 1,
                addons: [
                    { group: "kemasan", option: "Gift Wrap" },
                    { group: "ekstra", option: "Kartu Ucapan" },
                    { group: "ekstra", option: "Label Nama" },
                ],
            },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
        refund: {
            status: "REQUESTED",
            reason: "Isi pack kurang dari 10 buah.",
            requestedAfterHours: 30,
        },
    },
    {
        // Refund sudah selesai dibayarkan (REFUNDED) -> ALREADY_REFUNDED walau masih dalam 7 hari.
        label: "refund-selesai-dibayarkan",
        status: "SELESAI",
        createdDaysAgo: 6,
        distanceKm: 2.2,
        services: [],
        products: [
            { name: "Parfum Downy Passion 250ml", qty: 2, addons: [{ group: "kemasan", option: "Gift Wrap" }] },
            { name: "Softener Downy Refill 650ml", qty: 1 },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
        refund: {
            status: "REFUNDED",
            reason: "Kemasan produk rusak saat diterima.",
            requestedAfterHours: 28,
            processedAfterHours: 20,
        },
    },
    {
        // Refund ditolak admin.
        label: "refund-ditolak",
        status: "SELESAI",
        createdDaysAgo: 5,
        distanceKm: 1.5,
        services: [],
        products: [{ name: "Detergen Cair Buketan 1L", qty: 1 }],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
        refund: {
            status: "REJECTED",
            reason: "Berubah pikiran setelah produk dipakai.",
            note: "Produk telah dibuka dan digunakan, tidak memenuhi syarat pengembalian.",
            requestedAfterHours: 50,
            processedAfterHours: 12,
        },
    },
    {
        // Lewat masa tenggang 7 hari -> REFUND_WINDOW_EXPIRED.
        label: "produk-gateway-lewat-tenggang",
        status: "SELESAI",
        createdDaysAgo: 10,
        distanceKm: 1.8,
        services: [],
        products: [{ name: "Bayclin Pemutih Pakaian 500ml", qty: 1 }],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
    {
        // Order layanan murni dengan add-on layanan -> ITEM_NOT_PRODUCT.
        label: "layanan-add-on-tidak-bisa-refund",
        status: "SELESAI",
        createdDaysAgo: 3,
        distanceKm: 1,
        services: [
            {
                name: "Cuci Setrika",
                qty: 5,
                addons: [
                    { group: "detergen", option: "Premium" },
                    { group: "pewangi", option: "Sakura" },
                ],
            },
        ],
        products: [],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
    {
        // Campuran layanan + produk; refund parsial hanya untuk bagian produk (APPROVED).
        label: "campuran-refund-parsial-disetujui",
        status: "SELESAI",
        createdDaysAgo: 2,
        distanceKm: 1.2,
        services: [{ name: "Cuci Kering", qty: 3, addons: [{ group: "detergen", option: "Standard" }] }],
        products: [{ name: "Molto Ultra 720ml", qty: 1, addons: [{ group: "kemasan", option: "Bubble Wrap" }] }],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
        refund: {
            status: "APPROVED",
            reason: "Botol Molto bocor.",
            requestedAfterHours: 20,
            processedAfterHours: 6,
        },
    },
    {
        // Sedang diproses, lunas via transfer; add-on layanan + add-on produk.
        label: "diproses-campuran-addon-transfer-lunas",
        status: "DIPROSES",
        createdDaysAgo: 1,
        distanceKm: 2,
        services: [
            {
                name: "Cuci Setrika",
                qty: 2,
                addons: [
                    { group: "detergen", option: "Hypoallergenic" },
                    { group: "pewangi", option: "Lavender" },
                ],
            },
        ],
        products: [{ name: "Parfum Snappy 250ml", qty: 1, addons: [{ group: "ekstra", option: "Kartu Ucapan" }] }],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
    {
        // Order produk murni belum dibayar -> ORDER_STATUS_INVALID + PAYMENT_NOT_PAID.
        label: "baru-produk-gateway-belum-bayar",
        status: "BARU",
        createdDaysAgo: 0,
        distanceKm: 2.4,
        services: [],
        products: [
            { name: "Detergen Rinso Anti Noda 800g", qty: 2, addons: [{ group: "kemasan", option: "Bubble Wrap" }] },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PENDING",
    },
    {
        // Dibatalkan sebelum dibayar -> tidak ada arus kas.
        label: "batal-layanan-belum-bayar",
        status: "DIBATALKAN",
        createdDaysAgo: 6,
        distanceKm: 2,
        services: [{ name: "Cuci Kering", qty: 3 }],
        products: [],
        paymentMethod: "transfer_bank",
        paymentStatus: "PENDING",
        notes: "Dibatalkan pelanggan sebelum pembayaran.",
    },
    {
        // Produk murni, selesai, lunas tetapi COD -> PAYMENT_NOT_GATEWAY.
        label: "produk-cod-tidak-bisa-refund",
        status: "SELESAI",
        createdDaysAgo: 4,
        distanceKm: 2.8,
        services: [],
        products: [
            { name: "Softener Downy Refill 650ml", qty: 2, addons: [{ group: "kemasan", option: "Kardus Tambahan" }] },
            { name: "Lint Roller Pembersih Bulu", qty: 1, addons: [{ group: "ekstra", option: "Label Nama" }] },
        ],
        paymentMethod: "cod",
        paymentStatus: "PAID",
    },
    {
        // Siap antar, lunas via gateway, ada produk; refund belum boleh (status order).
        label: "siap-antar-campuran-gateway-lunas",
        status: "SIAP_ANTAR",
        createdDaysAgo: 1,
        distanceKm: 3.5,
        services: [{ name: "Express", qty: 3, addons: [{ group: "pewangi", option: "Standard" }] }],
        products: [
            { name: "Parfum Downy Passion 250ml", qty: 1, addons: [{ group: "kemasan", option: "Gift Wrap" }] },
        ],
        paymentMethod: "transfer_bank",
        paymentStatus: "PAID",
    },
];

/* ---------- Validasi konsistensi data demo (gagal cepat sebelum menulis ke DB) ---------- */

function assertDemoOrder(d: DemoOrder): void {
    const fail = (message: string): never => {
        throw new Error(`Demo order "${d.label}": ${message}`);
    };
    const lines = [...d.services, ...d.products];

    if (lines.length === 0) fail("tidak memiliki item");
    if (new Set(d.services.map((s) => s.name)).size !== d.services.length) fail("layanan duplikat dalam satu order");
    if (new Set(d.products.map((p) => p.name)).size !== d.products.length) fail("produk duplikat dalam satu order");
    if (lines.some((l) => !(l.qty > 0))) fail("qty harus lebih dari 0");
    if (d.products.some((p) => !Number.isInteger(p.qty))) fail("qty produk harus bilangan bulat");

    if (d.refund) {
        if (d.products.length === 0) fail("refund hanya untuk order yang berisi produk");
        if (d.status !== "SELESAI") fail("refund demo hanya untuk order SELESAI");
        if (d.paymentStatus !== "PAID") fail("refund demo hanya untuk pembayaran PAID");
        if (d.paymentMethod === "cod") fail("refund demo hanya untuk metode payment gateway");
        const processed = d.refund.processedAfterHours !== undefined;
        if ((d.refund.status === "REQUESTED") === processed) {
            fail("processedAfterHours wajib diisi untuk status selain REQUESTED, dan kosong untuk REQUESTED");
        }
    }
}

/* ---------- Pembantu pembangun data ---------- */

function buildStatusFlow(status: OrderStatus): readonly OrderStatus[] {
    if (status === "DIBATALKAN") return ["BARU", "DIBATALKAN"];
    return ORDER_PIPELINE.slice(0, ORDER_PIPELINE.indexOf(status) + 1);
}

function trackingNote(status: OrderStatus, productOnly: boolean): string {
    if (status === "BARU") return "Pesanan diterima. Menunggu konfirmasi outlet.";
    if (status === "DITERIMA") {
        return productOnly ? "Pesanan produk telah dikonfirmasi outlet." : "Pakaian telah diterima staf di outlet.";
    }
    if (status === "DIBATALKAN") return "Pesanan dibatalkan.";
    return `Status pesanan diperbarui menjadi ${status}.`;
}

function transactionId(method: PaymentMethod, orderId: string, virtualAccount: string): string {
    switch (method) {
        case "transfer_bank":
            return virtualAccount;
        case "cod":
            return `COD-${orderId}`;
    }
}

function paymentRawResponse(
    method: PaymentMethod,
    status: PaymentStatus,
    virtualAccount: string,
): Record<string, unknown> | null {
    if (status !== "PAID") return null;
    switch (method) {
        case "transfer_bank":
            return { gateway: "bank_transfer", method: "virtual_account", va_number: virtualAccount };
        case "cod":
            return { gateway: "cod", paidOnDelivery: true };
    }
}

function refundGatewayResponse(refund: DemoRefund, method: PaymentMethod): Record<string, unknown> | null {
    if (refund.status === "REFUNDED") return { gateway: method, status: "REFUNDED" };
    if (refund.status === "REJECTED") return { gateway: method, status: "REJECTED", note: refund.note ?? null };
    return null;
}

/* ---------- Konteks master data ---------- */

async function loadDemoContext() {
    const user = await prisma.orm.public.User.where({ email: "customer@fadarosi.id" }).first();
    const admin = await prisma.orm.public.User.where({ email: "admin@fadarosi.id" }).first();
    const outlet = await prisma.orm.public.Outlets.where({ id: 1 }).first();
    const address = user
        ? await prisma.orm.public.User_address.where({ user_id: user.id, is_primary: true }).first()
        : null;
    const services = await prisma.orm.public.Laundry_services.orderBy((s) => s.id.asc()).all();
    const products = await prisma.orm.public.Products.orderBy((p) => p.id.asc()).all();
    const groups = await prisma.orm.public.Service_addon_groups.all();
    const options = await prisma.orm.public.Service_addon_options.all();

    if (!user || !admin || !outlet || !address || services.length < 4 || products.length < 6) return null;

    const groupById = new Map(groups.map((g) => [g.id, g] as const));
    const optionByKey = new Map<string, (typeof options)[number]>();
    for (const option of options) {
        const group = groupById.get(option.group_id);
        if (group) optionByKey.set(`${group.code}:${option.name}`, option);
    }

    return {
        user,
        admin,
        outlet,
        address,
        products,
        groupById,
        optionByKey,
        serviceByName: new Map(services.map((s) => [String(s.name), s] as const)),
        productByName: new Map(products.map((p) => [String(p.name), p] as const)),
        productById: new Map(products.map((p) => [p.id, p] as const)),
    };
}

type DemoContext = NonNullable<Awaited<ReturnType<typeof loadDemoContext>>>;

/* ---------- Perencanaan order (tanpa menulis DB) ---------- */

function planDemoOrder(ctx: DemoContext, d: DemoOrder, seq: number) {
    assertDemoOrder(d);

    const createdAt = daysAgo(d.createdDaysAgo, 14);
    const orderId = orderEntity.generateOrderId(seq, daysAgo(d.createdDaysAgo));

    const priceAddon = (pick: AddonPick, itemQty: number) => {
        const option = required(
            ctx.optionByKey.get(`${pick.group}:${pick.option}`),
            `Add-on ${pick.group}/${pick.option} tidak ditemukan`,
        );
        const group = required(ctx.groupById.get(option.group_id), `Grup add-on id=${option.group_id} tidak ditemukan`);
        const unitPrice = money(option.price);
        const isPerOrder = option.price_mode === "per_order";
        return {
            option,
            group,
            qty: isPerOrder ? 1 : itemQty,
            subtotal: isPerOrder ? unitPrice : multiplyMoney(unitPrice, itemQty),
        };
    };

    /** Add-on harus terikat ke item utamanya dan menghormati aturan single-select. */
    const priceAddons = (
        picks: readonly AddonPick[],
        itemQty: number,
        allowedCodes: readonly string[],
        itemName: string,
    ) => {
        const seenSingle = new Set<string>();
        return picks.map((pick) => {
            if (!allowedCodes.includes(pick.group)) {
                throw new Error(`Add-on grup "${pick.group}" tidak berlaku untuk "${itemName}"`);
            }
            const priced = priceAddon(pick, itemQty);
            if (priced.group.selection_type === "single") {
                if (seenSingle.has(pick.group)) {
                    throw new Error(`Grup "${pick.group}" hanya boleh satu opsi pada "${itemName}"`);
                }
                seenSingle.add(pick.group);
            }
            return priced;
        });
    };

    const serviceAddonCodes = SERVICE_ADDON_GROUPS.map((g) => g.code);

    const serviceLines = d.services.map((line) => {
        const service = required(ctx.serviceByName.get(line.name), `Layanan "${line.name}" tidak ditemukan`);
        const unitPrice = money(service.price_per_unit);
        const addons = priceAddons(line.addons ?? [], line.qty, serviceAddonCodes, line.name);
        return {
            line,
            service,
            unitPrice,
            base: multiplyMoney(unitPrice, line.qty),
            addons,
            addonSubtotal: moneySum(addons.map((a) => a.subtotal)),
        };
    });

    const productLines = d.products.map((line) => {
        const product = required(ctx.productByName.get(line.name), `Produk "${line.name}" tidak ditemukan`);
        const unitPrice = money(product.price);
        const addons = priceAddons(line.addons ?? [], line.qty, addonCodesForProduct(String(product.category)), line.name);
        return {
            line,
            product,
            unitPrice,
            base: multiplyMoney(unitPrice, line.qty),
            addons,
            addonSubtotal: moneySum(addons.map((a) => a.subtotal)),
        };
    });

    const laundrySubtotal = moneySum(serviceLines.map((l) => l.base));
    const productSubtotal = moneySum(productLines.map((l) => l.base));
    const serviceAddonTotal = moneySum(serviceLines.map((l) => l.addonSubtotal));
    const productAddonTotal = moneySum(productLines.map((l) => l.addonSubtotal));
    const addonTotal = moneySum([serviceAddonTotal, productAddonTotal]);

    const deliveryFee = orderEntity.computeDeliveryFee(d.distanceKm);
    const totals = orderEntity.computeTotals({
        laundrySubtotal,
        productSubtotal,
        itemCount: d.services.length + d.products.length,
        deliveryFee,
    });
    // computeTotals belum mengenal add-on, jadi total add-on ditambahkan di sini.
    const totalAmount = moneySum([money(totals.total_amount), addonTotal]);

    return {
        d,
        orderId,
        createdAt,
        serviceLines,
        productLines,
        addonTotal,
        deliveryFee,
        totals,
        totalAmount,
        // Nilai refund = produk + add-on produk (tanpa layanan & ongkir).
        productRefundAmount: moneySum([productSubtotal, productAddonTotal]),
        virtualAccount: `2620${String(100_000_000_000 + seq * 7919)}`,
    };
}

type DemoPlan = ReturnType<typeof planDemoOrder>;

/* ---------- Penulisan order ke DB ---------- */

async function persistDemoOrder(ctx: DemoContext, plan: DemoPlan): Promise<void> {
    const { d, orderId, createdAt } = plan;
    const isPaid = d.paymentStatus === "PAID";
    const productOnly = d.services.length === 0;

    const trackings = buildStatusFlow(d.status).map((st, i) => ({
        status: varchar<20>(st),
        notes: trackingNote(st, productOnly),
        estimated_completion_time: instant(createdAt),
        created_at: instant(hoursAfter(createdAt, i)),
    }));

    // Cash_flow memiliki @@unique([order_id, type]): maksimal 1 income + 1 expense per order.
    const cashFlows: CashFlowSeed[] = [];
    if (isPaid) {
        cashFlows.push({
            type: varchar<20>("income"),
            category: varchar<40>("sales"),
            amount: numeric<12, 2>(plan.totalAmount),
            description: `Pembayaran ${d.paymentMethod} untuk order ${orderId}`,
            created_at: instant(createdAt),
        });
    }
    if (isPaid && d.status === "DIBATALKAN") {
        cashFlows.push({
            type: varchar<20>("expense"),
            category: varchar<40>("refund"),
            amount: numeric<12, 2>(plan.totalAmount),
            description: `Refund pembatalan order ${orderId} (${d.paymentMethod})`,
            created_at: instant(daysAgo(d.createdDaysAgo, 16)),
        });
    }
    if (d.refund?.status === "REFUNDED") {
        cashFlows.push({
            type: varchar<20>("expense"),
            category: varchar<40>("refund"),
            amount: numeric<12, 2>(plan.productRefundAmount),
            description: `Refund produk order ${orderId} (${d.paymentMethod})`,
            created_at: instant(
                hoursAfter(createdAt, d.refund.requestedAfterHours + (d.refund.processedAfterHours ?? 0)),
            ),
        });
    }

    await prisma.orm.public.Orders.create({
        order_id: orderId,
        user_id: ctx.user.id,
        outlet_id: ctx.outlet.id,
        user_address_id: ctx.address.id,
        distance_km: numeric<6, 2>(d.distanceKm),
        delivery_fee: numeric<10, 2>(plan.deliveryFee),
        total_laundry: numeric<12, 2>(plan.totals.total_laundry),
        total_product: numeric<12, 2>(plan.totals.total_product),
        total_addon: numeric<12, 2>(plan.addonTotal),
        total_amount: numeric<12, 2>(plan.totalAmount),
        status: varchar<20>(d.status),
        payment_method: varchar<20>(d.paymentMethod),
        notes: d.notes ?? null,
        created_at: instant(createdAt),
        serviceOrderItems: (items) =>
            items.create(
                plan.serviceLines.map((l) => ({
                    laundry_service_id: l.service.id,
                    qty: numeric<6, 2>(l.line.qty),
                    price_per_unit: numeric<12, 2>(l.unitPrice),
                    addon_subtotal: numeric<12, 2>(l.addonSubtotal),
                    subtotal: numeric<12, 2>(l.base),
                    notes: "",
                })),
            ),
        productOrderItems: (items) =>
            items.create(
                plan.productLines.map((l) => ({
                    product_id: l.product.id,
                    qty: l.line.qty,
                    subtotal: numeric<12, 2>(l.base),
                })),
            ),
        orderTrackings: (t) => t.create(trackings),
        payments: (p) =>
            p.create({
                transaction_id: transactionId(d.paymentMethod, orderId, plan.virtualAccount),
                payment_type: varchar<20>(d.paymentMethod),
                gross_amount: numeric<12, 2>(plan.totalAmount),
                status: varchar<30>(d.paymentStatus),
                va_number: d.paymentMethod === "transfer_bank" ? plan.virtualAccount : null,
                paid_at: isPaid ? instant(createdAt) : null,
                raw_response: paymentRawResponse(d.paymentMethod, d.paymentStatus, plan.virtualAccount) as never,
                created_at: instant(createdAt),
            }),
        ...(cashFlows.length > 0 ? { cashFlows: (c) => c.create(cashFlows) } : {}),
    });

    // Add-on layanan (snapshot nama & harga saat order).
    if (plan.serviceLines.some((l) => l.addons.length > 0)) {
        const rows = await prisma.orm.public.Service_order_item.where({ order_id: orderId }).all();
        for (const l of plan.serviceLines) {
            const row = required(
                rows.find((r) => r.laundry_service_id === l.service.id),
                `Item layanan "${l.line.name}" pada ${orderId} tidak ditemukan`,
            );
            for (const a of l.addons) {
                await prisma.orm.public.Service_order_item_addons.create({
                    service_order_item_id: row.id,
                    addon_option_id: a.option.id,
                    group_code: a.group.code,
                    group_name: a.group.name,
                    option_name: a.option.name,
                    price: a.option.price,
                    price_mode: a.option.price_mode,
                    qty: numeric<6, 2>(a.qty),
                    subtotal: numeric<12, 2>(a.subtotal),
                });
            }
        }
    }

    // Add-on produk.
    if (plan.productLines.some((l) => l.addons.length > 0)) {
        const rows = await prisma.orm.public.Product_order_item.where({ order_id: orderId }).all();
        for (const l of plan.productLines) {
            const row = required(
                rows.find((r) => r.product_id === l.product.id),
                `Item produk "${l.line.name}" pada ${orderId} tidak ditemukan`,
            );
            for (const a of l.addons) {
                await prisma.orm.public.Product_order_item_addons.create({
                    product_order_item_id: row.id,
                    addon_option_id: a.option.id,
                    group_code: a.group.code,
                    group_name: a.group.name,
                    option_name: a.option.name,
                    price: a.option.price,
                    price_mode: a.option.price_mode,
                    qty: numeric<6, 2>(a.qty),
                    subtotal: numeric<12, 2>(a.subtotal),
                });
            }
        }
    }

    // Refund request (terhubung ke payment order).
    if (d.refund) {
        const payment = required(
            await prisma.orm.public.Payments.where({ order_id: orderId }).first(),
            `Payment untuk ${orderId} tidak ditemukan`,
        );
        const requestedAt = hoursAfter(createdAt, d.refund.requestedAfterHours);
        const processedAt =
            d.refund.processedAfterHours === undefined ? null : hoursAfter(requestedAt, d.refund.processedAfterHours);

        await prisma.orm.public.Refund_requests.create({
            order_id: orderId,
            user_id: ctx.user.id,
            payment_id: payment.id,
            amount: numeric<12, 2>(plan.productRefundAmount),
            reason: d.refund.reason,
            status: varchar<20>(d.refund.status),
            gateway_ref: d.refund.status === "REFUNDED" ? `RFD-${orderId}` : null,
            gateway_response: refundGatewayResponse(d.refund, d.paymentMethod) as never,
            requested_at: instant(requestedAt),
            processed_at: processedAt ? instant(processedAt) : null,
            processed_by: processedAt ? ctx.admin.id : null,
        });
    }
}

async function createDemoOrders(): Promise<void> {
    const { count } = await prisma.orm.public.Orders.aggregate((agg) => ({ count: agg.count() }));
    if (count > 0) return;

    const ctx = await loadDemoContext();
    if (!ctx) {
        logger.info("demo orders skipped", { reason: "master data belum lengkap" });
        return;
    }

    // Fase 1: rencanakan semua order (gagal cepat bila data demo tidak konsisten).
    const plans = DEMO_ORDERS.map((d, index) => planDemoOrder(ctx, d, index + 1));

    // Fase 2: hitung kebutuhan stok total (order batal tidak mengurangi stok) dan validasi.
    const demand = new Map<number, number>();
    for (const plan of plans) {
        if (plan.d.status === "DIBATALKAN") continue;
        for (const l of plan.productLines) {
            demand.set(l.product.id, (demand.get(l.product.id) ?? 0) + l.line.qty);
        }
    }
    for (const [productId, qty] of demand) {
        const product = required(ctx.productById.get(productId), `Produk id=${productId} tidak ditemukan`);
        if (product.stock < qty) {
            throw new Error(`Stok "${product.name}" tidak cukup untuk demo order (butuh ${qty}, ada ${product.stock})`);
        }
    }

    // Fase 3: tulis ke DB.
    for (const plan of plans) {
        await persistDemoOrder(ctx, plan);
    }
    for (const [productId, qty] of demand) {
        const product = required(ctx.productById.get(productId), `Produk id=${productId} tidak ditemukan`);
        await prisma.orm.public.Products.where({ id: productId }).update({ stock: product.stock - qty });
    }

    logger.info("demo orders seeded", {
        count: plans.length,
        refundRequests: DEMO_ORDERS.filter((d) => d.refund).length,
    });
}

/* ==========================================================================
 * 3. MAIN
 * ========================================================================== */

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

    // Katalog add-on (layanan + produk) lalu tautkan ke layanan.
    await seedAddonCatalog();
    await linkServiceAddonGroups();

    const { count: productCount } = await prisma.orm.public.Products.aggregate((agg) => ({ count: agg.count() }));
    if (productCount === 0) {
        const productSeeds = [
            { name: "Detergen Cair Buketan 1L", category: "Detergen", price: 28000, size: "1L", stock: 35, is_active: true, image: "" },
            { name: "Detergen Rinso Anti Noda 800g", category: "Detergen", price: 22500, size: "800g", stock: 40, is_active: true, image: "" },
            { name: "Softener Downy Refill 650ml", category: "Softener", price: 21000, size: "650ml", stock: 25, is_active: true, image: "" },
            { name: "Molto Ultra 720ml", category: "Softener", price: 23000, size: "720ml", stock: 30, is_active: true, image: "" },
            { name: "Parfum Snappy 250ml", category: "Pewangi", price: 25000, size: "250ml", stock: 50, is_active: true, image: "" },
            { name: "Parfum Downy Passion 250ml", category: "Pewangi", price: 27500, size: "250ml", stock: 45, is_active: true, image: "" },
            { name: "Bayclin Pemutih Pakaian 500ml", category: "Pemutih", price: 11000, size: "500ml", stock: 20, is_active: true, image: "" },
            { name: "Vanish Oxi Action Liquid 450ml", category: "Pembersih Noda", price: 32000, size: "450ml", stock: 15, is_active: true, image: "" },
            { name: "Lint Roller Pembersih Bulu", category: "Aksesoris", price: 18000, size: "1 pcs", stock: 12, is_active: true, image: "" },
            { name: "Hanger Stainless (Isi 10)", category: "Aksesoris", price: 35000, size: "Pack 10", stock: 10, is_active: true, image: "" },
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

    // Tautkan add-on ke produk setelah produk tersedia.
    await linkProductAddonGroups();

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