import { serviceEntity } from "../../domain/entities/serviceEntity";
import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type { serviceType } from "../../domain/types/serviceType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class ListServicesUseCase {
    constructor(private readonly repository: serviceRepository) {}

    async execute(activeOnly = true): Promise<serviceType[]> {
        const data = await this.repository.list(activeOnly);
        logger.debug("services listed", { count: data.length, activeOnly });
        return data;
    }
}

export class GetServiceUseCase {
    constructor(private readonly repository: serviceRepository) {}

    async execute(id: number): Promise<serviceType> {
        const service = await this.repository.findById(id);
        if (!service) throw AppError.notFound("Layanan tidak ditemukan");
        return service;
    }
}

export class CreateServiceUseCase {
    constructor(private readonly repository: serviceRepository) {}

    async execute(input: unknown): Promise<serviceType> {
        const dto = serviceEntity.validateCreate(input);
        const service = await this.repository.create(dto);
        logger.info("service created", { serviceId: service.id, name: service.name });
        return service;
    }
}

export class UpdateServiceUseCase {
    constructor(private readonly repository: serviceRepository) {}

    async execute(id: number, input: unknown): Promise<serviceType> {
        const dto = serviceEntity.validateUpdate(input);
        const service = await this.repository.update(id, dto);
        if (!service) throw AppError.notFound("Layanan tidak ditemukan");
        logger.info("service updated", { serviceId: id });
        return service;
    }
}

export class DeleteServiceUseCase {
    constructor(private readonly repository: serviceRepository) {}

    async execute(id: number): Promise<void> {
        const removed = await this.repository.remove(id);
        if (!removed) throw AppError.notFound("Layanan tidak ditemukan");
        logger.info("service deactivated", { serviceId: id });
    }
}