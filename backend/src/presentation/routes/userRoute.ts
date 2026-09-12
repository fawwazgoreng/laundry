import { Hono } from "hono";
import { userController } from "../controllers/userController";
import { authMiddleware, tokenIssuer, tokenRepository, userRepository } from "./container";
import { LoginUserUseCase } from "../../useCase/user/loginUserUseCase";
import { LogoutUserUseCase } from "../../useCase/user/logoutUserUseCase";
import { RefreshTokenUseCase } from "../../useCase/user/refreshTokenUseCase";
import { RegisterUserUseCase } from "../../useCase/user/registerUserUseCase";
import { UpdateProfileUseCase } from "../../useCase/user/updateProfileUseCase";
import { authRateLimiter } from "../middleware/rateLimit";
import type { AppVariables } from "../types";

const controller = new userController(
    new RegisterUserUseCase(userRepository),
    new LoginUserUseCase(userRepository, tokenRepository, tokenIssuer),
    new RefreshTokenUseCase(userRepository, tokenRepository, tokenIssuer),
    new LogoutUserUseCase(tokenRepository),
    new UpdateProfileUseCase(userRepository),
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
userRouter.put("/profile", authMiddleware, (c) => controller.updateProfile(c));


export default userRouter;