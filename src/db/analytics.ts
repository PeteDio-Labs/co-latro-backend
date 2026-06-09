/**
 * PET-65 — play analytics counters. Daily UPSERTs against `event_counts`. Called from API hot
 * paths fire-and-forget (see callers in src/api/run.ts) — never await, never throw into a request.
 * One row per UTC day; `getDailyCounts` returns the last N days for queryability.
 */

import { desc, gte, sql } from "drizzle-orm";
import type { DB } from "./client.ts";
import { eventCounts, type EventCountsRow } from "./schema.ts";

/** Today's UTC date as YYYY-MM-DD — matches the `date` column. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

type CounterColumn = "runsStarted" | "runsWon" | "runsLost" | "handsPlayed";

/**
 * UPSERT today's row, incrementing one counter by 1. Single round-trip via ON CONFLICT.
 * The drizzle column name → SQL column name mapping mirrors the schema decl.
 */
async function bump(db: DB, col: CounterColumn): Promise<void> {
  const date = todayUtc();
  const insertRow = {
    date,
    runsStarted: col === "runsStarted" ? 1 : 0,
    runsWon: col === "runsWon" ? 1 : 0,
    runsLost: col === "runsLost" ? 1 : 0,
    handsPlayed: col === "handsPlayed" ? 1 : 0,
  } as const;
  const sqlCol = {
    runsStarted: "runs_started",
    runsWon: "runs_won",
    runsLost: "runs_lost",
    handsPlayed: "hands_played",
  }[col];
  await db
    .insert(eventCounts)
    .values(insertRow)
    .onConflictDoUpdate({
      target: eventCounts.date,
      set: { [col]: sql.raw(`"event_counts"."${sqlCol}" + 1`) },
    });
}

/** Fire-and-forget the bump; log (don't throw) if the write fails — analytics never breaks gameplay. */
function fireAndForget(p: Promise<void>): void {
  p.catch((err: unknown) => {
    console.error(JSON.stringify({ level: "error", source: "analytics", message: String(err) }));
  });
}

export function incRunStarted(db: DB): void {
  fireAndForget(bump(db, "runsStarted"));
}

export function incRunWon(db: DB): void {
  fireAndForget(bump(db, "runsWon"));
}

export function incRunLost(db: DB): void {
  fireAndForget(bump(db, "runsLost"));
}

export function incHandPlayed(db: DB): void {
  fireAndForget(bump(db, "handsPlayed"));
}

/**
 * Read helper for queryability: last `days` rows of event_counts, newest first. Defaults to a
 * week — enough for "what happened during testing" without paginating.
 */
export async function getDailyCounts(db: DB, days = 7): Promise<EventCountsRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceDate = since.toISOString().slice(0, 10);
  return db
    .select()
    .from(eventCounts)
    .where(gte(eventCounts.date, sinceDate))
    .orderBy(desc(eventCounts.date));
}

/** Test-only awaitable variants — production callers should stick to the fire-and-forget exports. */
export const _testing = {
  bumpAwait: (db: DB, col: CounterColumn): Promise<void> => bump(db, col),
};
