import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const store = new Map<string, string>();
const fakeLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: fakeLocalStorage, configurable: true });

type FetchMock = typeof fetch;
let fetchMock: import("bun:test").Mock<FetchMock>;

const { api, ApiError, tokenStore } = await import("../../src/services/apiClient");

function jsonRes(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

beforeEach(() => {
    store.clear();
    fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Promise.resolve(jsonRes({ success: true, data: { ok: true } }));
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
});

afterEach(() => {
    Object.defineProperty(globalThis, "fetch", { value: undefined, configurable: true });
});

describe("tokenStore", () => {
    it("persists and clears tokens", () => {
        tokenStore.set("access-1", "refresh-1");
        expect(tokenStore.getAccess()).toBe("access-1");
        expect(tokenStore.getRefresh()).toBe("refresh-1");
        tokenStore.clear();
        expect(tokenStore.getAccess()).toBeNull();
        expect(tokenStore.getRefresh()).toBeNull();
    });
});

describe("api.get", () => {
    it("returns data and sends the bearer token + content type", async () => {
        tokenStore.set("a", "r");
        const data = await api.get<{ ok: boolean }>("/users/me");

        expect(data).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalled();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://localhost:3000/api/users/me");
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer a");
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    });

    it("serialises query params and drops empty ones", async () => {
        await api.get("/orders", { page: 2, perPage: 5, status: "" });
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toContain("/orders?page=2&perPage=5");
        expect(url).not.toContain("status");
    });

    it("throws ApiError on a non-2xx envelope", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(jsonRes({ success: false, message: "Pesanan tidak ditemukan" }, 404)));

        try {
            await api.get("/orders/x");
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError);
            expect((error as ApiError).status).toBe(404);
            expect((error as ApiError).message).toBe("Pesanan tidak ditemukan");
        }
    });

    it("throws ApiError for a non-JSON error response", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(new Response("boom", { status: 500 })));

        try {
            await api.get("/orders/x");
            expect.unreachable();
        } catch (error) {
            expect((error as ApiError).status).toBe(500);
        }
    });
});

describe("401 recovery", () => {
    it("refreshes once and retries the original request", async () => {
        store.set("fadarosi_refresh_token", "refresh-tok");
        let requests = 0;
        fetchMock.mockImplementation((_input, init) => {
            const url = String(_input);
            requests++;
            if (url.includes("/users/refresh")) {
                const body = JSON.parse(String(init?.body));
                expect(body.refreshToken).toBe("refresh-tok");
                tokenStore.set("new-access", "new-refresh");
                return Promise.resolve(jsonRes({ success: true, data: { accessToken: "new-access", refreshToken: "new-refresh", user: {} } }));
            }
            if (requests <= 2) {
                return Promise.resolve(jsonRes({ success: false, message: "Token invalid" }, 401));
            }
            const auth = new Headers(init?.headers).get("Authorization");
            expect(auth).toBe("Bearer new-access");
            return Promise.resolve(jsonRes({ success: true, data: { ok: true } }));
        });

        const data = await api.get<{ ok: boolean }>("/admin/stats");

        expect(data).toEqual({ ok: true });
        expect(requests).toBe(3);
        expect(tokenStore.getAccess()).toBe("new-access");
    });

    it("clears tokens when the refresh itself fails", async () => {
        store.set("fadarosi_refresh_token", "expired");
        store.set("fadarosi_access_token", "old-access");
        fetchMock.mockImplementation((_input) =>
            Promise.resolve(
                String(_input).includes("/users/refresh")
                    ? jsonRes({ success: false, message: "Invalid refresh token" }, 401)
                    : jsonRes({ success: false, message: "Token invalid" }, 401),
            ),
        );

        try {
            await api.get("/users/me");
            expect.unreachable();
        } catch (error) {
            expect((error as ApiError).status).toBe(401);
        }
        expect(tokenStore.getAccess()).toBeNull();
        expect(tokenStore.getRefresh()).toBeNull();
    });
});

describe("api.post", () => {
    it("sends a JSON body", async () => {
        await api.post<{ ok: boolean }>("/orders", { services: [] });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://localhost:3000/api/orders");
        expect((init as RequestInit).method).toBe("POST");
        expect(String((init as RequestInit).body)).toBe(JSON.stringify({ services: [] }));
    });
});