/** Drizzle + postgres-js singleton. The DB is a Postgres server (see config.databaseUrl). */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

export type DB = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Open a Drizzle DB against a Postgres connection string. Connects lazily on first query. */
export function makeDb(url: string): DB {
  const client = postgres(url);
  return drizzle(client, { schema });
}

/** Apply generated migrations. Idempotent — safe to call at every boot. */
export function runMigrations(database: DB): Promise<void> {
  return migrate(database, { migrationsFolder });
}

let singleton: DB | null = null;

/** Lazily-opened process singleton against config.databaseUrl. */
export function getDb(): DB {
  singleton ??= makeDb(config.databaseUrl);
  return singleton;
}
