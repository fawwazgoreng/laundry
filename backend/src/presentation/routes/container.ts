import { env } from "../../config/env";
import { jwtTokenEntity } from "../../domain/entities/jwtToken";
import { pgAddressRepository } from "../../infrastructure/repository/pgAddressRepository";
import { pgCashflowRepository } from "../../infrastructure/repository/pgCashflowRepository";
import { pgOrderRepository } from "../../infrastructure/repository/pgOrderRepository";
import { pgOutletRepository } from "../../infrastructure/repository/pgOutletRepository";
import { pgPaymentRepository } from "../../infrastructure/repository/pgPaymentRepository";
import { pgProductRepository } from "../../infrastructure/repository/pgProductRepository";
import { pgServiceRepository } from "../../infrastructure/repository/pgServiceRepository";
import { pgStatsRepository } from "../../infrastructure/repository/pgStatsRepository";
import { pgTokenRepository } from "../../infrastructure/repository/pgTokenRepository";
import { pgUserRepository } from "../../infrastructure/repository/pgUserRepository";
import { AuthUseCase } from "../../useCase/user/authUseCase";
import { createAdminMiddleware } from "../middleware/adminMiddleware";
import { createAuthMiddleware } from "../middleware/authMiddleware";

export const userRepository = new pgUserRepository();
export const tokenRepository = new pgTokenRepository();
export const addressRepository = new pgAddressRepository();
export const outletRepository = new pgOutletRepository();
export const serviceRepository = new pgServiceRepository();
export const productRepository = new pgProductRepository();
export const orderRepository = new pgOrderRepository();
export const paymentRepository = new pgPaymentRepository();
export const cashflowRepository = new pgCashflowRepository();
export const statsRepository = new pgStatsRepository();

export const tokenIssuer = new jwtTokenEntity(
    env.JWT_SECRET,
    env.JWT_ACCESS_EXPIRES,
    env.JWT_REFRESH_EXPIRES,
);

export const authUseCase = new AuthUseCase(userRepository, tokenRepository, tokenIssuer);
export const authMiddleware = createAuthMiddleware(authUseCase);
export const adminMiddleware = createAdminMiddleware(authMiddleware);