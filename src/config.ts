/** Runtime configuration, read once at boot. */

// Postgres connection string. In prod this comes from the environment (sourced from
// Vault `kv/poker/db` by the deploy tooling); locally it defaults to a dev Postgres.
const defaultDatabaseUrl = "postgres://postgres:postgres@localhost:5432/colatro";

export const config = {
  port: Number(process.env.PORT) || 3020,
  env: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
} as const;
