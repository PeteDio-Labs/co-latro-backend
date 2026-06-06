/**
 * PET-65 — play analytics tests. The counter wrappers in src/db/analytics.ts fire-and-forget, so
 * tests reach for the awaitable `_testing.bumpAwait` to deterministically check the UPSERT path.
 * `getDailyCounts` is tested for the read shape.
 */

import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  _testing,
  getDailyCounts,
  incHandPlayed,
  incRunLost,
  incRunStarted,
  incRunWon,
} from "./analytics.ts";
import { freshDb } from "./testdb.ts";
import { eventCounts } from "./schema.ts";

const today = (): string => new Date().toISOString().slice(0, 10);

let db: Awaited<ReturnType<typeof freshDb>>;

beforeAll(async () => {
  db = await freshDb();
});

async function todayRow() {
  const rows = await db.select().from(eventCounts).where(eq(eventCounts.date, today())).limit(1);
  return rows[0];
}

describe("analytics counters", () => {
  it("INSERTs a fresh row when none exists for today, with the bumped counter at 1", async () => {
    await freshDb(); // reset
    await _testing.bumpAwait(db, "runsStarted");
    const row = await todayRow();
    expect(row).toBeTruthy();
    expect(row!.runsStarted).toBe(1);
    expect(row!.runsWon).toBe(0);
    expect(row!.runsLost).toBe(0);
    expect(row!.handsPlayed).toBe(0);
  });

  it("UPDATEs the existing row on a same-day second bump (ON CONFLICT)", async () => {
    await freshDb();
    await _testing.bumpAwait(db, "runsStarted");
    await _testing.bumpAwait(db, "runsStarted");
    await _testing.bumpAwait(db, "handsPlayed");
    const row = await todayRow();
    expect(row!.runsStarted).toBe(2);
    expect(row!.handsPlayed).toBe(1);

    // Still exactly one row for today (UPSERT, not duplicate inserts).
    const all = await db.select().from(eventCounts).where(eq(eventCounts.date, today()));
    expect(all.length).toBe(1);
  });

  it("fire-and-forget wrappers eventually persist their bump", async () => {
    await freshDb();
    incRunStarted(db);
    incRunWon(db);
    incRunLost(db);
    incHandPlayed(db);
    // Poll up to ~2s for fire-and-forget chains to flush (CI Postgres connect time + UPSERT
    // serialization can exceed a flat sleep on slow runners — see CI failure 2026-06-06).
    const deadline = Date.now() + 2000;
    let row;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
      row = await todayRow();
      if (row && row.runsStarted === 1 && row.runsWon === 1 && row.runsLost === 1 && row.handsPlayed === 1) break;
    }
    expect(row!.runsStarted).toBe(1);
    expect(row!.runsWon).toBe(1);
    expect(row!.runsLost).toBe(1);
    expect(row!.handsPlayed).toBe(1);
  });

  it("getDailyCounts returns the last N days newest-first and includes today's row", async () => {
    await freshDb();
    await _testing.bumpAwait(db, "runsStarted");
    const rows = await getDailyCounts(db, 7);
    expect(rows.length).toBe(1);
    expect(rows[0]!.date).toBe(today());
    expect(rows[0]!.runsStarted).toBe(1);
  });
});
