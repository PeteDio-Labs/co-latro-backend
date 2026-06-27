/** Drizzle schema (Postgres). The run's full state — including the hidden deck — rides in a JSONB column. */

import { sql } from "drizzle-orm";
import { bigint, date, index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { RunState } from "../engine/run.ts";

// Timestamps stay as integer epoch *seconds* (matching the prior SQLite `unixepoch()` default and the
// app's number-based contract) — bigint{mode:"number"} keeps them JS numbers in and out.
const epochDefault = sql`extract(epoch from now())::bigint`;

export const users = pgTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull().unique(), // username (case-sensitive, unique); also the display label
  // PET-206: argon2id hash of the user's password (Bun.password). Set at signup; never nullable —
  // every account is credentialed (the name-only find-or-create model was removed). Never returned.
  passwordHash: text("password_hash").notNull(),
  tokenHash: text("token_hash").notNull().unique(), // sha256(token) hex; raw token returned once at login
  // PET-60: epoch seconds the current token stops being valid (set at login). Nullable so a
  // user row can exist with no live token (after logout, which clears tokenHash + this).
  tokenExpiresAt: bigint("token_expires_at", { mode: "number" }),
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

/**
 * PET-65 — light play analytics. One row per UTC day; each counter UPSERTs +1 on activity.
 * Daily granularity keeps it queryable without keeping per-event PII; tester names are still
 * elsewhere (users / structured logs), not here.
 */
export const eventCounts = pgTable("event_counts", {
  date: date("date").primaryKey(), // UTC day (YYYY-MM-DD)
  runsStarted: integer("runs_started").notNull().default(0),
  runsWon: integer("runs_won").notNull().default(0),
  runsLost: integer("runs_lost").notNull().default(0),
  handsPlayed: integer("hands_played").notNull().default(0),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type GameSessionRow = typeof gameSessions.$inferSelect;
export type NewGameSessionRow = typeof gameSessions.$inferInsert;
export type EventCountsRow = typeof eventCounts.$inferSelect;
