import { describe, expect, it } from "bun:test";
import { sign } from "hono/jwt";
import { jwtTokenEntity } from "./jwtToken";
import { AppError } from "../../helper/errorHandling/appError";

function makeIssuer() {
    return new jwtTokenEntity("unit-test-secret", 60 * 15, 60 * 60 * 24 * 30);
}

describe("jwtTokenEntity", () => {
    it("generates and verifies an access token", async () => {
        const issuer = makeIssuer();
        const token = await issuer.generateAccessToken("user-1", "user");
        const payload = await issuer.verifyToken(token, "access");
        expect(payload.sub).toBe("user-1");
        expect(payload.role).toBe("user");
        expect(payload.type).toBe("access");
    });

    it("rejects a token used with the wrong type", async () => {
        const issuer = makeIssuer();
        const token = await issuer.generateRefreshToken("user-1", "admin");
        await expect(issuer.verifyToken(token, "access")).rejects.toThrow(AppError);
    });

    it("rejects a garbage token", async () => {
        await expect(makeIssuer().verifyToken("not-a-jwt", "access")).rejects.toThrow(AppError);
    });

    it("rejects an expired token", async () => {
        const issuer = makeIssuer();
        const now = Math.floor(Date.now() / 1000);
        const expired = await sign(
            { sub: "user-1", role: "user", type: "access", iat: now - 3600, exp: now - 60 },
            "unit-test-secret",
            "HS256",
        );
        await expect(issuer.verifyToken(expired, "access")).rejects.toThrow(AppError);
    });

    it("defaults access/refresh expiry windows", () => {
        const issuer = makeIssuer();
        const from = new Date(2026, 0, 1).getTime();
        expect(issuer.accessExpiresAt(from).getTime()).toBe(from + 15 * 60 * 1000);
        expect(issuer.refreshExpiresAt(from).getTime()).toBe(from + 30 * 24 * 3600 * 1000);
    });
});