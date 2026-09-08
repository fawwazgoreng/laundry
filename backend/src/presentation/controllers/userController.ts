import type { Context } from "hono";
import { created, ok } from "../../helper/response/apiResponse";
import { LoginUserUseCase } from "../../useCase/user/loginUserUseCase";
import { LogoutUserUseCase } from "../../useCase/user/logoutUserUseCase";
import { RefreshTokenUseCase } from "../../useCase/user/refreshTokenUseCase";
import { RegisterUserUseCase } from "../../useCase/user/registerUserUseCase";
import { UpdateProfileUseCase } from "../../useCase/user/updateProfileUseCase";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class userController {
    constructor(
        private readonly registerUseCase: RegisterUserUseCase,
        private readonly loginUseCase: LoginUserUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
        private readonly logoutUseCase: LogoutUserUseCase,
        private readonly updateProfileUseCase: UpdateProfileUseCase,
    ) {}

    async register(c: Context): Promise<Response> {
        const data = await this.registerUseCase.execute(await c.req.json());
        return created(c, data, "Account created");
    }

    async login(c: Context): Promise<Response> {
        const data = await this.loginUseCase.execute(await c.req.json());
        return ok(c, data, "Login successful");
    }

    async refresh(c: Context): Promise<Response> {
        const data = await this.refreshTokenUseCase.execute(await c.req.json());
        return ok(c, data, "Tokens refreshed");
    }

    async logout(c: AuthContext): Promise<Response> {
        await this.logoutUseCase.execute(c.get("userId"));
        return ok(c, null, "Logged out");
    }

    async me(c: AuthContext): Promise<Response> {
        return ok(c, c.get("user"), "Profile");
    }

    async updateProfile(c: AuthContext): Promise<Response> {
        const data = await this.updateProfileUseCase.execute(c.get("userId"), await c.req.json());
        return ok(c, data, "Profil diperbarui");
    }
}