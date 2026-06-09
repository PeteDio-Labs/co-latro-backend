/** Test-only DB helper: a single migrated Postgres handle, with per-call truncation for isolation.
 *
 * Tests need an ephemeral Postgres. Point TEST_DATABASE_URL (or DATABASE_URL) at one — e.g.:
 *   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:17
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres bun test
 */

import { sql } from "drizzle-orm";
import { makeDb, runMigrations, type DB } from "./client.ts";

const url =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/colatro";

let shared: DB | null = null;
let migrated: Promise<void> | null = null;

/** A migrated DB with all tables truncated — fully isolated state for the calling test. */
export async function freshDb(): Promise<DB> {
  shared ??= makeDb(url);
  migrated ??= runMigrations(shared);
  await migrated;
  // CASCADE + RESTART IDENTITY: wipe sessions+users+event_counts between tests without dropping the schema.
  await shared.execute(
    sql`truncate table game_sessions, users, event_counts restart identity cascade`,
  );
  return shared;
}
