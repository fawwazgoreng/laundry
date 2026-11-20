import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-mysql/config";

export default definePrismaConfig({
  orm: ormConfig({
    contract: "src/infrastructure/prisma/contract.prisma",

    output: "src/infrastructure/database/generated",

    db: {
      connection: process.env["DATABASE_URL"]!,
    },
  }),
  skills: {
    check: false,
  },
});
