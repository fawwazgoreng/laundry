import type {
    addonGroupCreateType,
    addonGroupUpdateType,
    addonOptionCreateType,
    addonOptionUpdateType,
    addonTargetType,
} from "../types/addonType";
import type { serviceAddonGroupType } from "../types/serviceType";

export interface addonRepository {
    listGroups(includeInactive: boolean): Promise<serviceAddonGroupType[]>
    findGroupById(id: number): Promise<serviceAddonGroupType | null>
    createGroup(data: addonGroupCreateType): Promise<serviceAddonGroupType>
    updateGroup(id: number, data: addonGroupUpdateType): Promise<serviceAddonGroupType | null>
    removeGroup(id: number): Promise<boolean>
    createOption(data: addonOptionCreateType): Promise<serviceAddonGroupType | null>
    updateOption(id: number, data: addonOptionUpdateType): Promise<serviceAddonGroupType | null>
    removeOption(id: number): Promise<boolean>
    listTargetGroupIds(targetType: addonTargetType, targetId: number): Promise<number[]>
    setTargetGroups(targetType: addonTargetType, targetId: number, groupIds: number[]): Promise<void>
}
