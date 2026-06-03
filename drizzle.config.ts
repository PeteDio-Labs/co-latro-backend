import { defineConfig } from "drizzle-kit";

// drizzle-kit reads the same DATABASE_URL the server uses (Postgres).
const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/colatro";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url },
});
