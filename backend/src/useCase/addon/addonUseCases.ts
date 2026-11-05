import { addonEntity } from "../../domain/entities/addonEntity";
import type { addonRepository } from "../../domain/repositories/addonRepository";
import type { productRepository } from "../../domain/repositories/productRepository";
import type { serviceRepository } from "../../domain/repositories/serviceRepository";
import type { addonTargetType } from "../../domain/types/addonType";
import { AppError } from "../../helper/errorHandling/appError";
import { logger } from "../../helper/logging/logger";

export class ListAddonGroupsUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(includeInactive = false) {
        const data = await this.addonRepository.listGroups(includeInactive);
        logger.debug("addon groups listed", { count: data.length, includeInactive });
        return data;
    }
}

export class CreateAddonGroupUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(input: unknown) {
        const data = addonEntity.validateGroupCreate(input);
        const group = await this.addonRepository.createGroup(data);
        logger.info("addon group created", { addonGroupId: group.id, code: group.code });
        return group;
    }
}

export class UpdateAddonGroupUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(id: number, input: unknown) {
        const data = addonEntity.validateGroupUpdate(input);
        const group = await this.addonRepository.updateGroup(id, data);
        if (!group) throw AppError.notFound("Grup add-on tidak ditemukan");
        logger.info("addon group updated", { addonGroupId: group.id, code: group.code });
        return group;
    }
}

export class DeleteAddonGroupUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(id: number): Promise<void> {
        const removed = await this.addonRepository.removeGroup(id);
        if (!removed) throw AppError.notFound("Grup add-on tidak ditemukan");
        logger.info("addon group deactivated", { addonGroupId: id });
    }
}

export class CreateAddonOptionUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(groupId: number, input: unknown) {
        const data = addonEntity.validateOptionCreate(groupId, input);
        const group = await this.addonRepository.createOption(data);
        if (!group) throw AppError.notFound("Grup add-on tidak ditemukan");
        logger.info("addon option created", { addonGroupId: groupId });
        return group;
    }
}

export class UpdateAddonOptionUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(id: number, input: unknown) {
        const data = addonEntity.validateOptionUpdate(input);
        const group = await this.addonRepository.updateOption(id, data);
        if (!group) throw AppError.notFound("Pilihan add-on tidak ditemukan");
        logger.info("addon option updated", { addonOptionId: id });
        return group;
    }
}

export class DeleteAddonOptionUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(id: number): Promise<void> {
        const removed = await this.addonRepository.removeOption(id);
        if (!removed) throw AppError.notFound("Pilihan add-on tidak ditemukan");
        logger.info("addon option deactivated", { addonOptionId: id });
    }
}

export class GetTargetAddonGroupsUseCase {
    constructor(private readonly addonRepository: addonRepository) { }

    async execute(targetTypeValue: string, targetId: number): Promise<number[]> {
        const targetType = addonEntity.validateTargetType(targetTypeValue);
        return this.addonRepository.listTargetGroupIds(targetType, targetId);
    }
}

export class SetTargetAddonGroupsUseCase {
    constructor(
        private readonly addonRepository: addonRepository,
        private readonly serviceRepository: serviceRepository,
        private readonly productRepository: productRepository,
    ) { }

    async execute(targetTypeValue: string, targetId: number, input: unknown): Promise<number[]> {
        const targetType = addonEntity.validateTargetType(targetTypeValue);
        const groupIds = addonEntity.validateGroupIds(input);
        await this.assertTargetExists(targetType, targetId);

        const groups = await this.addonRepository.listGroups(true);
        const availableIds = new Set(groups.map((group) => group.id));
        const invalid = groupIds.filter((id) => !availableIds.has(id));
        if (invalid.length > 0) {
            throw AppError.validation({ group_ids: `Grup add-on tidak ditemukan: ${invalid.join(", ")}` });
        }

        await this.addonRepository.setTargetGroups(targetType, targetId, groupIds);
        logger.info("addon groups attached", { targetType, targetId, groupIds });
        return this.addonRepository.listTargetGroupIds(targetType, targetId);
    }

    private async assertTargetExists(targetType: addonTargetType, targetId: number): Promise<void> {
        if (targetType === "service") {
            const service = await this.serviceRepository.findById(targetId);
            if (!service) throw AppError.notFound("Layanan tidak ditemukan");
            return;
        }
        const product = await this.productRepository.findById(targetId);
        if (!product) throw AppError.notFound("Produk tidak ditemukan");
    }
}
