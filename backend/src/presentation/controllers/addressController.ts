import type { Context } from "hono";
import { created, noContent, ok } from "../../helper/response/apiResponse";
import {
    CreateAddressUseCase,
    DeleteAddressUseCase,
    GetAddressUseCase,
    ListUserAddressesUseCase,
    SetPrimaryAddressUseCase,
    UpdateAddressUseCase,
} from "../../useCase/address/addressUseCases";
import type { AppVariables } from "../types";

type AuthContext = Context<{ Variables: AppVariables }>;

export class addressController {
    constructor(
        private readonly listUseCase: ListUserAddressesUseCase,
        private readonly createUseCase: CreateAddressUseCase,
        private readonly getUseCase: GetAddressUseCase,
        private readonly updateUseCase: UpdateAddressUseCase,
        private readonly deleteUseCase: DeleteAddressUseCase,
        private readonly setPrimaryUseCase: SetPrimaryAddressUseCase,
    ) {}

    async list(c: AuthContext): Promise<Response> {
        const data = await this.listUseCase.execute(c.get("userId"));
        return ok(c, data, "Daftar alamat");
    }

    async create(c: AuthContext): Promise<Response> {
        const data = await this.createUseCase.execute(c.get("userId"), await c.req.json());
        return created(c, data, "Alamat berhasil ditambahkan");
    }

    async get(c: AuthContext): Promise<Response> {
        const data = await this.getUseCase.execute(c.get("userId"), this.id(c));
        return ok(c, data, "Detail alamat");
    }

    async update(c: AuthContext): Promise<Response> {
        const data = await this.updateUseCase.execute(c.get("userId"), this.id(c), await c.req.json());
        return ok(c, data, "Alamat berhasil diperbarui");
    }

    async remove(c: AuthContext): Promise<Response> {
        await this.deleteUseCase.execute(c.get("userId"), this.id(c));
        return noContent(c);
    }

    async setPrimary(c: AuthContext): Promise<Response> {
        const data = await this.setPrimaryUseCase.execute(c.get("userId"), this.id(c));
        return ok(c, data, "Alamat utama diperbarui");
    }

    private id(c: AuthContext): number {
        return Number(c.req.param("id"));
    }
}