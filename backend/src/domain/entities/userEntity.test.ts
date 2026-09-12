import { describe, expect, it } from "bun:test";
import { userEntity } from "./userEntity";
import { AppError } from "../../helper/errorHandling/appError";

function validRegister() {
    return {
        username: "siti_nur",
        email: "siti@test.local",
        password: "Password123",
        phone: "081234567890",
    };
}

describe("userEntity.validateRegister", () => {
    it("accepts a valid registration", () => {
        const dto = userEntity.validateRegister(validRegister());
        expect(dto.email).toBe("siti@test.local");
    });

    it("rejects a weak password", () => {
        for (const password of ["short", "alllowercase1", "ALLUPPER1", "NoDigits"]) {
            expect(() => userEntity.validateRegister({ ...validRegister(), password })).toThrow(AppError);
        }
    });

    it("rejects an invalid email", () => {
        expect(() => userEntity.validateRegister({ ...validRegister(), email: "not-an-email" })).toThrow(AppError);
    });

    it("rejects a bad phone number", () => {
        expect(() => userEntity.validateRegister({ ...validRegister(), phone: "123" })).toThrow(AppError);
    });

    it("rejects a short username", () => {
        expect(() => userEntity.validateRegister({ ...validRegister(), username: "ab" })).toThrow(AppError);
    });
});

describe("userEntity.validateLogin", () => {
    it("accepts valid credentials", () => {
        expect(userEntity.validateLogin({ email: "siti@test.local", password: "hopefully" }).email).toBe("siti@test.local");
    });

    it("rejects malformed credentials", () => {
        expect(() => userEntity.validateLogin({ email: "x", password: "" })).toThrow(AppError);
    });
});

describe("userEntity password helpers", () => {
    it("hashes and verifies a password round-trip", async () => {
        const hash = await userEntity.hashPassword("Password123");
        expect(hash).not.toBe("Password123");
        expect(await userEntity.verifyPassword("Password123", hash)).toBe(true);
        expect(await userEntity.verifyPassword("WrongPass1", hash)).toBe(false);
    });
});