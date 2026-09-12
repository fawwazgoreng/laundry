import { describe, expect, it, mock } from "bun:test";
import { RegisterUserUseCase } from "./registerUserUseCase";
import { LoginUserUseCase } from "./loginUserUseCase";
import { RefreshTokenUseCase } from "./refreshTokenUseCase";
import { LogoutUserUseCase } from "./logoutUserUseCase";
import { UpdateProfileUseCase } from "./updateProfileUseCase";
import { AuthUseCase } from "./authUseCase";
import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import type { tokenRepository } from "../../domain/repositories/tokenRepository";
import type { userRepository } from "../../domain/repositories/userRepository";
import { AppError } from "../../helper/errorHandling/appError";

function makeIssuer() {
    return new jwtTokenEntity("unit-test-secret", 60 * 15, 60 * 60 * 24 * 30);
}

const adminUser = {
    id: "u-admin",
    username: "Admin",
    email: "admin@test.local",
    role: "admin" as const,
    phone: "081234567890",
    is_verified: true,
};

const customerUser = {
    id: "u-1",
    username: "Budi",
    email: "budi@test.local",
    role: "user" as const,
    phone: "08123456789",
    is_verified: true,
};

describe("RegisterUserUseCase", () => {
    it("registers a new user with a hashed password", async () => {
        const userRepo = {
            findByEmail: mock(() => null),
            create: mock(() => customerUser),
        } as unknown as userRepository;

        const result = await new RegisterUserUseCase(userRepo).execute({
            username: "Budi",
            email: "budi@test.local",
            password: "Password123",
            phone: "08123456789",
        });

        expect(result.email).toBe("budi@test.local");
        const created = (userRepo.create as ReturnType<typeof mock>).mock.calls[0][0];
        expect(created.password).not.toBe("Password123");
        expect(created.password).toContain("$");
    });

    it("rejects a duplicate email", async () => {
        const userRepo = {
            findByEmail: mock(() => customerUser),
            create: mock(() => customerUser),
        } as unknown as userRepository;

        await expect(
            new RegisterUserUseCase(userRepo).execute({
                username: "Budi",
                email: "budi@test.local",
                password: "Password123",
                phone: "08123456789",
            }),
        ).rejects.toMatchObject({ statusCode: 409 });
    });
});

describe("LoginUserUseCase", () => {
    it("returns tokens for valid credentials", async () => {
        const hash = await Bun.password.hash("Password123");
        const userRepo = {
            findByEmail: mock(() => ({ ...customerUser, password: hash })),
            findById: mock(),
            updateUsername: mock(),
            updateProfile: mock(),
        } as unknown as userRepository;
        const tokenRepo = { saveTokens: mock(async () => {}), findValidAccessToken: mock(), findValidRefreshToken: mock(), revokeUserTokens: mock() } as unknown as tokenRepository;
        const issuer = makeIssuer();

        const result = await new LoginUserUseCase(userRepo, tokenRepo, issuer).execute({
            email: "budi@test.local",
            password: "Password123",
        });

        expect(result.user.email).toBe("budi@test.local");
        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();
        expect(tokenRepo.saveTokens).toHaveBeenCalled();

        const payload = await issuer.verifyToken(result.accessToken, "access");
        expect(payload.sub).toBe("u-1");
    });

    it("rejects an unknown email", async () => {
        const userRepo = { findByEmail: mock(() => null) } as unknown as userRepository;
        await expect(
            new LoginUserUseCase(userRepo, { saveTokens: mock(), findValidAccessToken: mock(), findValidRefreshToken: mock(), revokeUserTokens: mock() } as unknown as tokenRepository, makeIssuer()).execute({
                email: "ghost@test.local",
                password: "Password123",
            }),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("rejects a wrong password", async () => {
        const hash = await Bun.password.hash("Password123");
        const userRepo = { findByEmail: mock(() => ({ ...customerUser, password: hash })) } as unknown as userRepository;
        await expect(
            new LoginUserUseCase(userRepo, { saveTokens: mock(), findValidAccessToken: mock(), findValidRefreshToken: mock(), revokeUserTokens: mock() } as unknown as tokenRepository, makeIssuer()).execute({
                email: "budi@test.local",
                password: "WrongPass1",
            }),
        ).rejects.toMatchObject({ statusCode: 401 });
    });
});

describe("RefreshTokenUseCase", () => {
    it("rotates tokens for a valid refresh token", async () => {
        const issuer = makeIssuer();
        const refreshToken = await issuer.generateRefreshToken(customerUser.id, customerUser.role);
        const userRepo = {
            findById: mock(() => customerUser),
            findByEmail: mock(),
            create: mock(),
            updateUsername: mock(),
            updateProfile: mock(),
        } as unknown as userRepository;
        const tokenRepo = {
            saveTokens: mock(async () => {}),
            findValidAccessToken: mock(() => null),
            findValidRefreshToken: mock(() => ({ user_id: customerUser.id })),
            revokeUserTokens: mock(),
        } as unknown as tokenRepository;

        const result = await new RefreshTokenUseCase(userRepo, tokenRepo, issuer).execute({ refreshToken });

        expect(result.user.id).toBe("u-1");
        expect(result.accessToken).toBeTruthy();
        expect(await issuer.verifyToken(result.refreshToken, "refresh")).toMatchObject({ sub: "u-1" });
        expect(tokenRepo.saveTokens).toHaveBeenCalled();
    });

    it("rejects a missing refresh token", async () => {
        const issuer = makeIssuer();
        await expect(
            new RefreshTokenUseCase({ findById: mock() } as unknown as userRepository, { saveTokens: mock(), findValidRefreshToken: mock() } as unknown as tokenRepository, issuer).execute({}),
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("rejects a token whose stored owner does not match", async () => {
        const issuer = makeIssuer();
        const refreshToken = await issuer.generateRefreshToken(customerUser.id, customerUser.role);
        const tokenRepo = {
            saveTokens: mock(),
            findValidRefreshToken: mock(() => ({ user_id: "someone-else" })),
            findValidAccessToken: mock(),
            revokeUserTokens: mock(),
        } as unknown as tokenRepository;

        await expect(new RefreshTokenUseCase({ findById: mock() } as unknown as userRepository, tokenRepo, issuer).execute({ refreshToken })).rejects.toMatchObject({ statusCode: 401 });
    });
});

describe("LogoutUserUseCase", () => {
    it("revokes all user tokens", async () => {
        const tokenRepo = { revokeUserTokens: mock(async () => {}) } as unknown as tokenRepository;
        await new LogoutUserUseCase(tokenRepo).execute("u-1");
        expect(tokenRepo.revokeUserTokens).toHaveBeenCalledWith("u-1");
    });
});

describe("UpdateProfileUseCase", () => {
    it("updates allowed fields", async () => {
        const userRepo = { updateProfile: mock(() => ({ ...customerUser, phone: "081298765432" })) } as unknown as userRepository;
        const result = await new UpdateProfileUseCase(userRepo).execute("u-1", { phone: "081298765432" });
        expect(result.phone).toBe("081298765432");
    });

    it("rejects an empty update", async () => {
        await expect(new UpdateProfileUseCase({ updateProfile: mock() } as unknown as userRepository).execute("u-1", {})).rejects.toMatchObject({ statusCode: 422 });
    });

    it("rejects a malformed phone", async () => {
        await expect(new UpdateProfileUseCase({ updateProfile: mock() } as unknown as userRepository).execute("u-1", { phone: "abc" })).rejects.toMatchObject({ statusCode: 422 });
    });
});

describe("AuthUseCase.authenticate", () => {
    it("resolves the user for a valid, stored access token", async () => {
        const issuer = makeIssuer();
        const accessToken = await issuer.generateAccessToken(customerUser.id, customerUser.role);
        const userRepo = { findById: mock(() => customerUser) } as unknown as userRepository;
        const tokenRepo = {
            findValidAccessToken: mock(() => ({ user_id: customerUser.id, token: accessToken })),
            saveTokens: mock(),
            findValidRefreshToken: mock(),
            revokeUserTokens: mock(),
        } as unknown as tokenRepository;

        const user = await new AuthUseCase(userRepo, tokenRepo, issuer).authenticate(accessToken);
        expect(user.id).toBe("u-1");
    });

    it("rejects a revoked token", async () => {
        const issuer = makeIssuer();
        const accessToken = await issuer.generateAccessToken(customerUser.id, customerUser.role);
        const tokenRepo = { findValidAccessToken: mock(() => null), saveTokens: mock(), findValidRefreshToken: mock(), revokeUserTokens: mock() } as unknown as tokenRepository;

        await expect(new AuthUseCase({ findById: mock() } as unknown as userRepository, tokenRepo, issuer).authenticate(accessToken)).rejects.toThrow(AppError);
    });

    it("rejects a token for a deleted account", async () => {
        const issuer = makeIssuer();
        const accessToken = await issuer.generateAccessToken(customerUser.id, customerUser.role);
        const tokenRepo = { findValidAccessToken: mock(() => ({ user_id: customerUser.id })), saveTokens: mock(), findValidRefreshToken: mock(), revokeUserTokens: mock() } as unknown as tokenRepository;

        await expect(new AuthUseCase({ findById: mock(() => null) } as unknown as userRepository, tokenRepo, issuer).authenticate(accessToken)).rejects.toThrow(AppError);
    });
});