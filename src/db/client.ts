/** Drizzle + bun:sqlite singleton. The DB file lives on local disk (see config.dbPath). */

import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

export type DB = BunSQLiteDatabase<typeof schema>;

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Open a Drizzle DB at `path` (use ":memory:" in tests). Sets WAL + foreign keys. */
export function makeDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

/** Apply generated migrations. Idempotent — safe to call at every boot. */
export function runMigrations(database: DB): void {
  migrate(database, { migrationsFolder });
}

let singleton: DB | null = null;

/** Lazily-opened process singleton against config.dbPath (real local-disk file). */
export function getDb(): DB {
  singleton ??= makeDb(config.dbPath);
  return singleton;
}
