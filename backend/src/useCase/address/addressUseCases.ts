import { addressEntity } from "../../domain/entities/addressEntity";
import type { addressRepository } from "../../domain/repositories/addressRepository";
import type { addressType } from "../../domain/types/addressType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class ListUserAddressesUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string): Promise<addressType[]> {
        const data = await this.repository.listByUser(userId);
        logger.debug("addresses listed", { userId, count: data.length });
        return data;
    }
}

export class CreateAddressUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string, input: unknown): Promise<addressType> {
        const dto = addressEntity.validateCreate(input);
        const count = await this.repository.countByUser(userId);
        const isFirst = count === 0;
        const address = await this.repository.create(userId, dto, isFirst);
        logger.info("address created", { userId, addressId: address.id, isPrimary: address.is_primary });
        return address;
    }
}

export class GetAddressUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string, id: number): Promise<addressType> {
        const address = await this.repository.findById(userId, id);
        if (!address) throw AppError.notFound("Alamat tidak ditemukan");
        return address;
    }
}

export class UpdateAddressUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string, id: number, input: unknown): Promise<addressType> {
        const dto = addressEntity.validateUpdate(input);
        const address = await this.repository.update(userId, id, dto);
        if (!address) throw AppError.notFound("Alamat tidak ditemukan");
        logger.info("address updated", { userId, addressId: id });
        return address;
    }
}

export class DeleteAddressUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string, id: number): Promise<void> {
        const removed = await this.repository.remove(userId, id);
        if (!removed) throw AppError.notFound("Alamat tidak ditemukan");
        logger.info("address deleted", { userId, addressId: id });
    }
}

export class SetPrimaryAddressUseCase {
    constructor(private readonly repository: addressRepository) {}

    async execute(userId: string, id: number): Promise<addressType> {
        const address = await this.repository.setPrimary(userId, id);
        if (!address) throw AppError.notFound("Alamat tidak ditemukan");
        logger.info("address set primary", { userId, addressId: id });
        return address;
    }
}