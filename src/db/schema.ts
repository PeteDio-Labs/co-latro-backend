/** Drizzle schema (SQLite). The run's full state — including the hidden deck — rides in a JSON column. */

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { RunState } from "../engine/run.ts";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull().unique(), // display label; identity, no password
  tokenHash: text("token_hash").notNull().unique(), // sha256(token) hex; raw token returned once at login
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  lastSeenAt: integer("last_seen_at").notNull().default(sql`(unixepoch())`),
});

export const gameSessions = sqliteTable(
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
    state: text("state", { mode: "json" }).$type<RunState>().notNull(), // full RunState incl. hidden deck
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
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
