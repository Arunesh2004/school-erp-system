import "dotenv/config"

import { defineConfig, env } from "prisma/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"

export default defineConfig({
  schema: "prisma/schema.prisma",



  datasource: {
    url: env("DATABASE_URL"),
  },

  engine: "classic",

  adapter: () => {
    return new PrismaLibSql({
      url: env("DATABASE_URL") as string,
      authToken: env("DATABASE_AUTH_TOKEN") as string,
    })
  },
})
