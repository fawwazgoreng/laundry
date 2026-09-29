import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import app from "../../src/index";
import { prisma } from "../../src/infrastructure/prisma/prisma";
import { resetTestDb } from "./helpers";

type ApiOptions = {
    token?: string
    body?: unknown
    ip?: string
};

function api(method: string, path: string, options: ApiOptions = {}) {
    return app.request(path, {
        method,
        headers: {
            "content-type": "application/json",
            "cf-connecting-ip": options.ip ?? `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
}

async function json(res: Response): Promise<Record<string, any>> {
    return (await res.json()) as Record<string, any>;
}

function future(days: number): string {
    return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
}

function orderPayload(serviceIds: number[], addressId: number, overrides: Record<string, unknown> = {}) {
    return {
        services: [{ laundry_service_id: serviceIds[0], qty: 2 }],
        products: [],
        user_address_id: addressId,
        outlet_id: 1,
        distance_km: 1.5,
        payment_method: "transfer_bank",
        pickup_schedule: future(1),
        estimated_delivery: future(2),
        ...overrides,
    };
}

let customerToken: string;
let adminToken: string;
let customerAddressId: number;
let serviceIds: number[];
let productIds: number[];

beforeAll(async () => {
    await resetTestDb();

    const register = await json(
        await api("POST", "/api/users/register", {
            ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
            body: {
                username: "siti_nur",
                email: "siti@fadarosi.id",
                password: "Password123",
                phone: "081234567811",
            },
        }),
    );
    expect(register.success).toBe(true);
    expect(register.data).not.toHaveProperty("accessToken");

    const login = await json(
        await api("POST", "/api/users/login", {
            ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
            body: { email: "siti@fadarosi.id", password: "Password123" },
        }),
    );
    customerToken = login.data.accessToken;

    const adminLogin = await json(
        await api("POST", "/api/users/login", {
            ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
            body: { email: "test-admin@fadarosi.id", password: "Admin@1234" },
        }),
    );
    adminToken = adminLogin.data.accessToken;

    const addr = await json(
        await api("POST", "/api/addresses", {
            token: customerToken,
            body: {
                label: "Rumah Siti",
                address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
                latitude: -6.2001,
                longitude: 106.7839,
            },
        }),
    );
    customerAddressId = addr.data.id;

    serviceIds = (await prisma.laundry_services.findMany({ orderBy: { id: "asc" } })).map((s) => s.id);
    productIds = (await prisma.products.findMany({ orderBy: { id: "asc" } })).map((p) => p.id);
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("health", () => {
    it("reports database up", async () => {
        const res = await api("GET", "/health", { ip: `10.0.1.${Math.floor(Math.random() * 250) + 1}` });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.database).toBe("up");
    });
});

describe("public catalog", () => {
    it("lists outlets", async () => {
        const res = await api("GET", "/api/outlets", { ip: `10.0.2.${Math.floor(Math.random() * 250) + 1}` });
        expect(res.status).toBe(200);
        expect((await json(res)).data[0].name).toContain("Test Outlet");
    });

    it("lists services", async () => {
        const res = await api("GET", "/api/services", { ip: `10.0.3.${Math.floor(Math.random() * 250) + 1}` });
        const body = await json(res);
        expect(body.data.length).toBe(3);
    });

    it("lists products with pagination meta", async () => {
        const res = await api("GET", "/api/products?page=1&perPage=2", { ip: `10.0.4.${Math.floor(Math.random() * 250) + 1}` });
        const body = await json(res);
        expect(body.meta.count).toBeGreaterThanOrEqual(3);
        expect(body.meta.currentPage).toBe(1);
        expect(body.data.length).toBe(2);
    });
});

describe("addresses", () => {
    it("creates, lists, promotes and deletes an address", async () => {
        const created = await json(
            await api("POST", "/api/addresses", {
                token: customerToken,
                body: {
                    label: "Kantor",
                    address_text: "Jl. Sudirman No. 20, Jakarta Pusat",
                    latitude: -6.2001,
                    longitude: 106.8004,
                },
            }),
        );
        expect(created.data.is_primary).toBe(false);
        expect(created.data.id).toBeGreaterThan(1);

        const second = await json(
            await api("POST", "/api/addresses", {
                token: customerToken,
                body: {
                    label: "Rumah",
                    address_text: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
                    latitude: -6.2001,
                    longitude: 106.7839,
                },
            }),
        );

        const primary = await json(await api("PATCH", `/api/addresses/${second.data.id}/primary`, { token: customerToken }));
        expect(primary.data.is_primary).toBe(true);

        const list = await json(await api("GET", "/api/addresses", { token: customerToken }));
        expect(list.data.length).toBe(3);
        expect(list.data.find((a: any) => a.id === second.data.id).is_primary).toBe(true);

        const updated = await json(await api("PUT", `/api/addresses/${created.data.id}`, { token: customerToken, body: { label: "Kantor Baru" } }));
        expect(updated.data.label).toBe("Kantor Baru");

        const del = await api("DELETE", `/api/addresses/${created.data.id}`, { token: customerToken });
        expect(del.status).toBe(204);

        const removed = await api("GET", `/api/addresses/${created.data.id}`, { token: customerToken });
        expect(removed.status).toBe(404);
    });

    it("rejects an invalid address", async () => {
        const res = await api("POST", "/api/addresses", {
            token: customerToken,
            body: { label: "X", address_text: "Jl.", latitude: 999, longitude: 106 },
        });
        expect(res.status).toBe(422);
    });
});

describe("orders", () => {
    it("creates a transfer_bank order with a midtrans snap transaction", async () => {
        const res = await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId) });
        expect(res.status).toBe(201);
        const body = await json(res);
        expect(body.data.order_id).toMatch(/^CLN-\d{8}-\d{3}$/);
        expect(body.data.token).toBeTruthy();
        expect(body.data.redirect_url).toMatch(/^https:\/\//);

        const detail = await json(await api("GET", `/api/orders/${body.data.order_id}`, { token: customerToken }));
        expect(detail.data.status).toBe("BARU");
        expect(detail.data.delivery_fee).toBe(3000);
        expect(detail.data.payment.status).toBe("PENDING");
        expect(detail.data.payment.payment_type).toBe("transfer_bank");
        expect(detail.data.payment.transaction_id).toBe(body.data.token);
    });

    it("creates a fadarosipay order and books income immediately", async () => {
        const res = await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId, { payment_method: "fadarosipay" }) });
        const body = await json(res);
        expect(res.status).toBe(201);

        const detail = await json(await api("GET", `/api/orders/${body.data.order_id}`, { token: customerToken }));
        expect(detail.data.payment.status).toBe("PAID");

        const cf = await prisma.cash_flow.findFirst({ where: { order_id: detail.data.order_id } });
        expect(cf?.type).toBe("income");
        expect(Number(cf?.amount)).toBe(detail.data.total_amount);
    });

    it("rejects an order exceeding product stock", async () => {
        const res = await api("POST", "/api/orders", {
            token: customerToken,
            body: orderPayload(serviceIds, customerAddressId, {
                products: [{ product_id: productIds[2], qty: 99 }],
            }),
        });
        expect(res.status).toBe(409);
    });

    it("rejects an invalid payment method", async () => {
        const res = await api("POST", "/api/orders", {
            token: customerToken,
            body: orderPayload(serviceIds, customerAddressId, { payment_method: "bitcoin" }),
        });
        expect(res.status).toBe(422);
    });

    it("creates a cod order and completes payment on SELESAI", async () => {
        const created = await json(
            await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId, { payment_method: "cod" }) }),
        );
        const orderId = created.data.order_id;

        for (const status of ["DITERIMA", "DIPROSES", "SIAP_ANTAR", "SELESAI"]) {
            const res = await api("PATCH", `/api/orders/${orderId}/status`, {
                token: adminToken,
                body: { status },
            });
            expect(res.status).toBe(200);
        }

        const detail = await json(await api("GET", `/api/orders/${orderId}`, { token: customerToken }));
        expect(detail.data.status).toBe("SELESAI");
        expect(detail.data.payment.status).toBe("PAID");

        const cf = await prisma.cash_flow.findFirst({ where: { order_id: orderId, type: "income" } });
        expect(Number(cf?.amount)).toBe(detail.data.total_amount);

        const tracking = await json(await api("GET", `/api/orders/${orderId}/tracking`, { token: customerToken }));
        expect(tracking.data.length).toBe(5);
    });

    it("rejects a skpped status transition", async () => {
        const created = await json(
            await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId, { payment_method: "cod" }) }),
        );
        const res = await api("PATCH", `/api/orders/${created.data.order_id}/status`, {
            token: adminToken,
            body: { status: "SELESAI" },
        });
        expect(res.status).toBe(409);
    });

    it("forbids non-admins from updating status", async () => {
        const created = await json(
            await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId, { payment_method: "cod" }) }),
        );
        const res = await api("PATCH", `/api/orders/${created.data.order_id}/status`, {
            token: customerToken,
            body: { status: "DITERIMA" },
        });
        expect(res.status).toBe(403);
    });

    it("lets the owner cancel a BARU order", async () => {
        const created = await json(
            await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId, { payment_method: "cod" }) }),
        );
        const res = await api("PATCH", `/api/orders/${created.data.order_id}/cancel`, { token: customerToken });
        expect(res.status).toBe(200);
        expect((await json(res)).data.status).toBe("DIBATALKAN");
    });

    it("blocks cancelling another customer's order", async () => {
        await api("POST", "/api/users/register", {
            ip: `10.0.12.${Math.floor(Math.random() * 250) + 1}`,
            body: { username: "agus", email: "agus@fadarosi.id", password: "Password123", phone: "081234567814" },
        });
        const otherLogin = await json(
            await api("POST", "/api/users/login", {
                ip: `10.0.13.${Math.floor(Math.random() * 250) + 1}`,
                body: { email: "agus@fadarosi.id", password: "Password123" },
            }),
        );
        const otherAddr = await json(
            await api("POST", "/api/addresses", {
                token: otherLogin.data.accessToken,
                body: {
                    label: "Rumah Agus",
                    address_text: "Jl. Mawar No. 8, Jakarta Timur",
                    latitude: -6.2,
                    longitude: 106.9,
                },
            }),
        );

        const created = await json(
            await api("POST", "/api/orders", { token: otherLogin.data.accessToken, body: orderPayload(serviceIds, otherAddr.data.id) }),
        );
        const res = await api("PATCH", `/api/orders/${created.data.order_id}/cancel`, { token: customerToken });
        expect(res.status).toBe(403);

        const forbiddenDetail = await api("GET", `/api/orders/${created.data.order_id}`, { token: customerToken });
        expect(forbiddenDetail.status).toBe(403);

        const adminDetail = await json(await api("GET", `/api/orders/${created.data.order_id}`, { token: adminToken }));
        expect(adminDetail.data.customer.username).toBe("agus");
    });

    it("lists orders with pagination meta for customers and admins", async () => {
        const userList = await json(await api("GET", "/api/orders?page=1&perPage=5", { token: customerToken }));
        expect(userList.meta.count).toBeGreaterThanOrEqual(6);
        expect(userList.meta.lastPage).toBeGreaterThanOrEqual(1);

        const adminList = await json(
            await api("GET", "/api/orders?status=SELESAI&perPage=5", { token: adminToken }),
        );
        expect(Array.isArray(adminList.data)).toBe(true);
    });

    it("rejects listing orders without a token", async () => {
        const res = await api("GET", "/api/orders", { ip: `10.0.14.${Math.floor(Math.random() * 250) + 1}` });
        expect(res.status).toBe(401);
    });
});

describe("payments", () => {
    it("confirms a transfer_bank payment and books income", async () => {
        const created = await json(
            await api("POST", "/api/orders", { token: customerToken, body: orderPayload(serviceIds, customerAddressId) }),
        );
        const detail = await json(await api("GET", `/api/orders/${created.data.order_id}`, { token: customerToken }));
        const txId = detail.data.payment.transaction_id;

        const confirmed = await json(
            await api("POST", "/api/payments/confirm", {
                token: adminToken,
                body: { transaction_id: txId, status: "PAID", raw_response: { gateway: "bank" } },
            }),
        );
        expect(confirmed.data.status).toBe("PAID");

        const cf = await prisma.cash_flow.findFirst({ where: { order_id: confirmed.data.order_id, type: "income" } });
        expect(cf?.category).toBe("sales");

        const again = await api("POST", "/api/payments/confirm", {
            token: adminToken,
            body: { transaction_id: txId, status: "PAID" },
        });
        expect(again.status).toBe(409);
    });

    it("requires an admin to confirm payments", async () => {
        const res = await api("POST", "/api/payments/confirm", {
            token: customerToken,
            body: { transaction_id: "DOES-NOT-MATTER" },
        });
        expect(res.status).toBe(403);
    });
});

describe("admin", () => {
    it("returns stats for admins", async () => {
        const res = await api("GET", "/api/admin/stats", { token: adminToken });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(typeof body.data.orders_today).toBe("number");
        expect(typeof body.data.revenue_today).toBe("number");
        expect(body.data.revenue_today).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(body.data.recent_orders)).toBe(true);
    });

    it("returns a cash-flow summary for admins", async () => {
        const res = await api("GET", "/api/admin/cash-flow", { token: adminToken });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(typeof body.data.total_income).toBe("number");
        expect(typeof body.data.balance).toBe("number");
        expect(body.data.total_income).toBeGreaterThan(0);
    });

    it("forbids customers from admin endpoints", async () => {
        const res = await api("GET", "/api/admin/stats", { token: customerToken });
        expect(res.status).toBe(403);
    });
});

describe("auth", () => {
    it("rejects a duplicate email on register", async () => {
        const res = await api("POST", "/api/users/register", {
            ip: `10.0.5.${Math.floor(Math.random() * 250) + 1}`,
            body: { username: "siti_lagi", email: "siti@fadarosi.id", password: "Password123", phone: "081234567812" },
        });
        expect(res.status).toBe(409);
    });

    it("rejects a weak password", async () => {
        const res = await api("POST", "/api/users/register", {
            ip: `10.0.6.${Math.floor(Math.random() * 250) + 1}`,
            body: { username: "budi", email: "budi@fadarosi.id", password: "weak", phone: "081234567813" },
        });
        expect(res.status).toBe(422);
    });

    it("rejects a wrong password", async () => {
        const res = await api("POST", "/api/users/login", {
            ip: `10.0.7.${Math.floor(Math.random() * 250) + 1}`,
            body: { email: "siti@fadarosi.id", password: "WrongPass1" },
        });
        expect(res.status).toBe(401);
    });

    it("returns the profile for a valid token", async () => {
        const res = await api("GET", "/api/users/me", { token: customerToken });
        const body = await json(res);
        expect(res.status).toBe(200);
        expect(body.data.email).toBe("siti@fadarosi.id");
    });

    it("rejects access without a token", async () => {
        const res = await api("GET", "/api/users/me", { ip: `10.0.8.${Math.floor(Math.random() * 250) + 1}` });
        expect(res.status).toBe(401);
    });

    it("rotates tokens on refresh", async () => {
        const login = await json(
            await api("POST", "/api/users/login", {
                ip: `10.0.9.${Math.floor(Math.random() * 250) + 1}`,
                body: { email: "siti@fadarosi.id", password: "Password123" },
            }),
        );
        const res = await api("POST", "/api/users/refresh", {
            ip: `10.0.10.${Math.floor(Math.random() * 250) + 1}`,
            body: { refreshToken: login.data.refreshToken },
        });
        const body = await json(res);
        expect(res.status).toBe(200);
        expect(body.data.accessToken).toBeTruthy();
        expect(body.data.user.email).toBe("siti@fadarosi.id");
    });

    it("revokes tokens on logout", async () => {
        const reg = await json(
            await api("POST", "/api/users/register", {
                ip: `10.0.11.${Math.floor(Math.random() * 250) + 1}`,
                body: { username: "doni", email: "doni@fadarosi.id", password: "Password123", phone: "081234567815" },
            }),
        );
        expect(reg.success).toBe(true);
        const login = await json(
            await api("POST", "/api/users/login", {
                ip: `10.0.11.${Math.floor(Math.random() * 250) + 1}`,
                body: { email: "doni@fadarosi.id", password: "Password123" },
            }),
        );
        await api("POST", "/api/users/logout", { token: login.data.accessToken });
        const res = await api("GET", "/api/users/me", { token: login.data.accessToken });
        expect(res.status).toBe(401);
    });
});

describe("not found & validation envelopes", () => {
    it("returns a structured 404", async () => {
        const res = await api("GET", "/api/goldfish", { ip: randomUUID() });
        expect(res.status).toBe(404);
        expect((await json(res)).success).toBe(false);
    });

    it("returns a structured 400 for invalid JSON", async () => {
        const res = await app.request("/api/users/login", {
            method: "POST",
            headers: { "content-type": "application/json", "cf-connecting-ip": randomUUID() },
            body: "{not-json",
        });
        expect(res.status).toBe(400);
    });
});