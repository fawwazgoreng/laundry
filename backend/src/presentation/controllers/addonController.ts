import type { Context } from "hono";
import { created, noContent, ok } from "../../helper/response/apiResponse";
import { parseIdParam } from "../../helper/http/queryParams";
import {
    CreateAddonGroupUseCase,
    CreateAddonOptionUseCase,
    DeleteAddonGroupUseCase,
    DeleteAddonOptionUseCase,
    GetTargetAddonGroupsUseCase,
    ListAddonGroupsUseCase,
    SetTargetAddonGroupsUseCase,
    UpdateAddonGroupUseCase,
    UpdateAddonOptionUseCase,
} from "../../useCase/addon/addonUseCases";

export class addonController {
    constructor(
        private readonly listUseCase: ListAddonGroupsUseCase,
        private readonly createGroupUseCase: CreateAddonGroupUseCase,
        private readonly updateGroupUseCase: UpdateAddonGroupUseCase,
        private readonly deleteGroupUseCase: DeleteAddonGroupUseCase,
        private readonly createOptionUseCase: CreateAddonOptionUseCase,
        private readonly updateOptionUseCase: UpdateAddonOptionUseCase,
        private readonly deleteOptionUseCase: DeleteAddonOptionUseCase,
        private readonly getTargetUseCase: GetTargetAddonGroupsUseCase,
        private readonly setTargetUseCase: SetTargetAddonGroupsUseCase,
    ) {}

    async list(c: Context): Promise<Response> {
        const includeInactive = c.req.query("all") === "true";
        return ok(c, await this.listUseCase.execute(includeInactive), "Daftar grup add-on");
    }

    async createGroup(c: Context): Promise<Response> {
        return created(c, await this.createGroupUseCase.execute(await c.req.json()), "Grup add-on dibuat");
    }

    async updateGroup(c: Context): Promise<Response> {
        const data = await this.updateGroupUseCase.execute(parseIdParam(c.req.param("id")), await c.req.json());
        return ok(c, data, "Grup add-on diperbarui");
    }

    async removeGroup(c: Context): Promise<Response> {
        await this.deleteGroupUseCase.execute(parseIdParam(c.req.param("id")));
        return noContent(c);
    }

    async createOption(c: Context): Promise<Response> {
        const data = await this.createOptionUseCase.execute(
            parseIdParam(c.req.param("groupId")),
            await c.req.json(),
        );
        return created(c, data, "Pilihan add-on dibuat");
    }

    async updateOption(c: Context): Promise<Response> {
        const data = await this.updateOptionUseCase.execute(parseIdParam(c.req.param("id")), await c.req.json());
        return ok(c, data, "Pilihan add-on diperbarui");
    }

    async removeOption(c: Context): Promise<Response> {
        await this.deleteOptionUseCase.execute(parseIdParam(c.req.param("id")));
        return noContent(c);
    }

    async getTarget(c: Context): Promise<Response> {
        const data = await this.getTargetUseCase.execute(
            c.req.param("targetType")!,
            parseIdParam(c.req.param("targetId")),
        );
        return ok(c, data, "Grup add-on target");
    }

    async setTarget(c: Context): Promise<Response> {
        const data = await this.setTargetUseCase.execute(
            c.req.param("targetType")!,
            parseIdParam(c.req.param("targetId")),
            await c.req.json(),
        );
        return ok(c, data, "Grup add-on target diperbarui");
    }
}
