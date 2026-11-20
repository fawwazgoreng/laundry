// src/lib/prisma.ts
import mysql from "@prisma/orm-mysql/runtime";
import { contractFromJson } from "@prisma/orm-mysql/static";
import type { SqlMiddleware } from "@prisma/orm-mysql/family-runtime";
import type { SqlRuntimeExtensionDescriptor } from "@prisma/orm-family-sql/runtime";
import { generateId } from "@prisma/orm-framework/ids/runtime";
import { env } from "../../config/env";

import type { Contract } from "../database/generated/contract";
import contractJson from "../database/generated/contract.json";

// JSON.stringify gagal pada BigInt, jadi diubah ke string dulu
const stringify = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));

function queryLogger(): SqlMiddleware {
  return {
    name: "query-logger",
    familyId: "sql",

    async beforeEncode(plan) {
      console.log(`\n[Prisma SQL Kueri]: ${plan.sql}`);
      if (plan.params && plan.params.length > 0) {
        console.log(`[Parameter]: ${stringify(plan.params)}`);
      }
    },
  };
}

const idGeneratorIds = ["uuidv7"] as const;

const idGeneratorDefaults = idGeneratorIds.map((id) => ({
  id,
  generate: (params: Record<string, unknown> | undefined) =>
    params === undefined ? generateId({ id }) : generateId({ id, params }),
  stability: "field" as const,
}));

const idGeneratorsExtension: SqlRuntimeExtensionDescriptor<"mysql"> = {
  kind: "extension",
  id: "builtin-id-generators",
  version: "1.0.0",
  familyId: "sql",
  targetId: "mysql",
  codecs: () => [],
  mutationDefaultGenerators: () => idGeneratorDefaults,
  create: () => ({ familyId: "sql", targetId: "mysql" }),
};

export const contract = contractFromJson<Contract>(contractJson);

export const prisma = mysql({
  contract,
  extensions: [idGeneratorsExtension],
  url: env.DATABASE_URL,
  poolOptions: {
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  },
  // Kosong saat production agar tidak ada beban I/O log
  middleware: env.NODE_ENV === "development" ? [queryLogger()] : [],
});
