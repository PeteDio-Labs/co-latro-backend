/** Drizzle schema (Postgres). The run's full state — including the hidden deck — rides in a JSONB column. */

import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { RunState } from "../engine/run.ts";

// Timestamps stay as integer epoch *seconds* (matching the prior SQLite `unixepoch()` default and the
// app's number-based contract) — bigint{mode:"number"} keeps them JS numbers in and out.
const epochDefault = sql`extract(epoch from now())::bigint`;

export const users = pgTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull().unique(), // display label; identity, no password
  tokenHash: text("token_hash").notNull().unique(), // sha256(token) hex; raw token returned once at login
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(epochDefault),
  lastSeenAt: bigint("last_seen_at", { mode: "number" }).notNull().default(epochDefault),
});

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: text("id").primaryKey(), // == runId
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // status/ante/difficulty are denormalized copies of fields inside `state` (for querying without parsing JSON)
    status: text("status").notNull(),
    ante: integer("ante").notNull(),
    difficulty: text("difficulty").notNull(),
    state: jsonb("state").$type<RunState>().notNull(), // full RunState incl. hidden deck
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(epochDefault),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(epochDefault),
  },
  (t) => [
    index("idx_sessions_user_status").on(t.userId, t.status),
    index("idx_sessions_user_updated").on(t.userId, t.updatedAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type GameSessionRow = typeof gameSessions.$inferSelect;
export type NewGameSessionRow = typeof gameSessions.$inferInsert;
