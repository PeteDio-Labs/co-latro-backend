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
  // Hand-level keys added after this run was first persisted (e.g. PET-73 secret hands)
  // default to level 1 so the engine doesn't trip on `undefined`.
  const levels = s.handLevels as Record<string, number>;
  const defaults = defaultHandLevels() as Record<string, number>;
  for (const k of Object.keys(defaults)) {
    if (levels[k] == null) levels[k] = 1;
  }
  s.shop ??= null;
  s.jokers ??= [];
  s.deckComposition ??= standardFaces().map(faceCode);
  s.deckId ??= "standard";
  s.deckName ??= "Standard Deck";
  s.pendingRewardBreakdown ??= null;
  // PET-67 foundation slots — empty-defaults so older saves load cleanly.
  s.consumables ??= [];
  s.maxConsumables ??= 2;
  s.vouchers ??= [];
  s.tags ??= [];
  s.skipsThisRun ??= 0;
  s.currentBossEffect ??= null;
  s.jokerStates ??= {};
  // PET-67 joker editions — older saves predate the per-joker edition overlay.
  s.jokerEditions ??= {};
  s.discardsUsedThisBlind ??= 0;
  s.heldGoldRoundEnd ??= false;
  // PET-70 pack flow — older saves predate the openingPack field.
  s.openingPack ??= null;
  // PET-75 card modifier overlay — older saves predate this.
  s.deckEnhancements ??= {};
  // Persisted shop state may pre-date the voucher slot — default it to null.
  if (s.shop && typeof s.shop === "object") {
    const sh = s.shop as Record<string, unknown>;
    sh.voucher ??= null;
  }
  return state;
}

/** Latest non-terminal run for a user, or null. Drives resume routing. */
export async function getActiveRun(db: DB, userId: string): Promise<RunState | null> {
  const rows = await db
    .select({ state: gameSessions.state })
    .from(gameSessions)
    .where(and(eq(gameSessions.userId, userId), notInArray(gameSessions.status, TERMINAL)))
    .orderBy(desc(gameSessions.updatedAt))
    .limit(1);
  const state = rows[0]?.state;
  return state ? normalizeRun(state) : null;
}

/** Remove the user's active (non-terminal) run(s) — used to overwrite the save on a new run. */
export async function deleteActiveRuns(db: DB, userId: string): Promise<void> {
  await db
    .delete(gameSessions)
    .where(and(eq(gameSessions.userId, userId), notInArray(gameSessions.status, TERMINAL)));
}

export async function getRunById(db: DB, runId: string): Promise<RunState | null> {
  const rows = await db
    .select({ state: gameSessions.state })
    .from(gameSessions)
    .where(eq(gameSessions.id, runId))
    .limit(1);
  const state = rows[0]?.state;
  return state ? normalizeRun(state) : null;
}

export async function insertRun(db: DB, run: RunState): Promise<void> {
  await db.insert(gameSessions).values({
    id: run.runId,
    userId: run.userId,
    status: run.status,
    ante: run.ante,
    difficulty: run.difficulty,
    state: run,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  });
}

/** Persist the run JSON + denormalized status/ante/difficulty + updatedAt. */
export async function saveRun(db: DB, run: RunState): Promise<void> {
  run.updatedAt = Date.now();
  await db
    .update(gameSessions)
    .set({
      status: run.status,
      ante: run.ante,
      difficulty: run.difficulty,
      state: run,
      updatedAt: run.updatedAt,
    })
    .where(eq(gameSessions.id, run.runId));
}
