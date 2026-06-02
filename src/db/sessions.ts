/** Repository for persisted runs. The DB is authoritative; saveRun keeps denormalized cols in sync. */

import { and, desc, eq, notInArray } from "drizzle-orm";
import type { DB } from "./client.ts";
import { gameSessions } from "./schema.ts";
import type { RunState } from "../engine/run.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";

const TERMINAL = ["won_run", "lost_run"];

/** Backfill fields added in later sprints onto runs persisted by older code. */
function normalizeRun(state: RunState): RunState {
  const s = state as unknown as Record<string, unknown>;
  s.handLevels ??= defaultHandLevels();
  s.shop ??= null;
  s.jokers ??= [];
  s.deckComposition ??= standardFaces().map(faceCode);
  s.deckId ??= "standard";
  s.deckName ??= "Standard Deck";
  return state;
}

/** Latest non-terminal run for a user, or null. Drives resume routing. */
export function getActiveRun(db: DB, userId: string): RunState | null {
  const rows = db
    .select({ state: gameSessions.state })
    .from(gameSessions)
    .where(and(eq(gameSessions.userId, userId), notInArray(gameSessions.status, TERMINAL)))
    .orderBy(desc(gameSessions.updatedAt))
    .limit(1)
    .all();
  const state = rows[0]?.state;
  return state ? normalizeRun(state) : null;
}

/** Remove the user's active (non-terminal) run(s) — used to overwrite the save on a new run. */
export function deleteActiveRuns(db: DB, userId: string): void {
  db.delete(gameSessions)
    .where(and(eq(gameSessions.userId, userId), notInArray(gameSessions.status, TERMINAL)))
    .run();
}

export function getRunById(db: DB, runId: string): RunState | null {
  const row = db
    .select({ state: gameSessions.state })
    .from(gameSessions)
    .where(eq(gameSessions.id, runId))
    .get();
  const state = row?.state;
  return state ? normalizeRun(state) : null;
}

export function insertRun(db: DB, run: RunState): void {
  db.insert(gameSessions)
    .values({
      id: run.runId,
      userId: run.userId,
      status: run.status,
      ante: run.ante,
      difficulty: run.difficulty,
      state: run,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    })
    .run();
}

/** Persist the run JSON + denormalized status/ante/difficulty + updatedAt. */
export function saveRun(db: DB, run: RunState): void {
  run.updatedAt = Date.now();
  db.update(gameSessions)
    .set({
      status: run.status,
      ante: run.ante,
      difficulty: run.difficulty,
      state: run,
      updatedAt: run.updatedAt,
    })
    .where(eq(gameSessions.id, run.runId))
    .run();
}
