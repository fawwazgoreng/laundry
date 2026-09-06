import { Hono } from "hono";
import { env } from "../../config/env";
import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import { pgTokenRepository } from "../../infrastructure/repository/pgTokenRepository";
import { pgUserRepository } from "../../infrastructure/repository/pgUserRepository";
import { AuthUseCase } from "../../useCase/user/authUseCase";
import { LoginUserUseCase } from "../../useCase/user/loginUserUseCase";
import { LogoutUserUseCase } from "../../useCase/user/logoutUserUseCase";
import { RefreshTokenUseCase } from "../../useCase/user/refreshTokenUseCase";
import { RegisterUserUseCase } from "../../useCase/user/registerUserUseCase";
import { userController } from "../controllers/userController";
import { createAuthMiddleware } from "../middleware/authMiddleware";
import { authRateLimiter } from "../middleware/rateLimit";
import type { AppVariables } from "../types";

const userRepository = new pgUserRepository();
const tokenRepository = new pgTokenRepository();
const tokenIssuer = new jwtTokenEntity(env.JWT_SECRET, env.JWT_ACCESS_EXPIRES, env.JWT_REFRESH_EXPIRES);

const controller = new userController(
    new RegisterUserUseCase(userRepository),
    new LoginUserUseCase(userRepository, tokenRepository, tokenIssuer),
    new RefreshTokenUseCase(userRepository, tokenRepository, tokenIssuer),
    new LogoutUserUseCase(tokenRepository),
);
const authMiddleware = createAuthMiddleware(
    new AuthUseCase(userRepository, tokenRepository, tokenIssuer),
);

const userRouter = new Hono<{ Variables: AppVariables }>();

userRouter.use("/register", authRateLimiter);
userRouter.use("/login", authRateLimiter);
userRouter.use("/refresh", authRateLimiter);

userRouter.post("/register", (c) => controller.register(c));
userRouter.post("/login", (c) => controller.login(c));
userRouter.post("/refresh", (c) => controller.refresh(c));
userRouter.post("/logout", authMiddleware, (c) => controller.logout(c));
userRouter.get("/me", authMiddleware, (c) => controller.me(c));

export default userRouter;