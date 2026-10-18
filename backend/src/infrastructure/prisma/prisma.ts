// src/lib/prisma.ts
import postgres from "@prisma/orm-postgres/runtime";
import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import { env } from "../../config/env";

import type { Contract } from "../database/generated/contract.d";
import contractJson from "../database/generated/contract.json";

// JSON.stringify gagal pada BigInt, jadi diubah ke string dulu
const stringify = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));

function queryLogger(): SqlMiddleware {
  return {
    name: "query-logger",
    familyId: "sql",

    // Berjalan untuk setiap query setelah SQL dibuat, sebelum dikirim ke database
    async beforeEncode(plan) {
      console.log(`\n[Prisma SQL Kueri]: ${plan.sql}`);
      if (plan.params && plan.params.length > 0) {
        console.log(`[Parameter]: ${stringify(plan.params)}`);
      }
    },
  };
}

export const prisma = postgres<Contract>({
  contractJson,
  url: env.DATABASE_URL,
  poolOptions: {
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  },
  // Kosong saat production agar tidak ada beban I/O log
  middleware: env.NODE_ENV === "development" ? [queryLogger()] : [],
});