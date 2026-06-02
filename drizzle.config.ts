import { defineConfig } from "drizzle-kit";

// drizzle-kit runs under Node — keep this file free of bun:sqlite imports.
const dbPath =
  process.env.POKER_DB_PATH ?? `${process.env.HOME ?? "."}/.local/share/poker-mvp/poker.db`;

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: dbPath },
});
