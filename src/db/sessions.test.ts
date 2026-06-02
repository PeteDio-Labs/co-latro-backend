import { eq } from "drizzle-orm";
import { describe, expect, it } from "bun:test";
import { makeDb, runMigrations, type DB } from "./client.ts";
import { getActiveRun, getRunById, insertRun, saveRun } from "./sessions.ts";
import { gameSessions, users } from "./schema.ts";
import { playHand, startBlind, startRun, type RunState } from "../engine/run.ts";

function freshDb(): DB {
  const db = makeDb(":memory:");
  runMigrations(db);
  return db;
}

function seedUser(db: DB, id = "u1", name = "U1"): string {
  db.insert(users).values({ id, name, tokenHash: `${name}-hash` }).run();
  return id;
}

describe("sessions repo", () => {
  it("round-trips a run incl. the hidden deck", () => {
    const db = freshDb();
    const uid = seedUser(db);
    const run = startRun("medium", uid);
    startBlind(run); // deals 8, deck 44
    run.jokers.push("the_duo");
    insertRun(db, run);

    const got = getRunById(db, run.runId);
    expect(got).toEqual(run);
    expect(got?.deck.length).toBe(44);
    expect(got?.hand.length).toBe(8);
    expect(got?.deckComposition.length).toBe(52);
    expect(got?.handLevels.pair).toBe(1);
    expect(got?.deckId).toBe("standard");
    expect(got?.jokers).toEqual(["the_duo"]);
  });

  it("backfills legacy runs missing new fields", () => {
    const db = freshDb();
    const uid = seedUser(db);
    const legacy = {
      runId: "legacy1",
      userId: uid,
      difficulty: "easy",
      ante: 1,
      blindIndex: 0,
      money: 0,
      target: 300,
      totalScore: 0,
      hand: [],
      deck: [],
      handsRemaining: 0,
      discardsRemaining: 0,
      lastPlay: null,
      status: "selecting_blind",
      pendingReward: null,
      createdAt: 0,
      updatedAt: 0,
      // no handLevels / shop / deckComposition / deckId / deckName
    };
    db.insert(gameSessions)
      .values({
        id: "legacy1",
        userId: uid,
        status: "selecting_blind",
        ante: 1,
        difficulty: "easy",
        state: legacy as unknown as RunState,
        createdAt: 0,
        updatedAt: 0,
      })
      .run();

    const got = getRunById(db, "legacy1")!;
    expect(got.handLevels.pair).toBe(1);
    expect(got.deckComposition.length).toBe(52);
    expect(got.deckId).toBe("standard");
    expect(got.shop).toBeNull();
    expect(got.jokers).toEqual([]);
  });

  it("saveRun persists mutations", () => {
    const db = freshDb();
    const uid = seedUser(db);
    const run = startRun("medium", uid);
    startBlind(run);
    insertRun(db, run);

    playHand(run, [run.hand[0]!.id]);
    saveRun(db, run);

    const got = getRunById(db, run.runId)!;
    expect(got.totalScore).toBe(run.totalScore);
    expect(got.handsRemaining).toBe(run.handsRemaining);
    expect(got.hand.map((c) => c.id)).toEqual(run.hand.map((c) => c.id));
    expect(got.deck.length).toBe(run.deck.length);
  });

  it("getActiveRun ignores terminal runs", () => {
    const db = freshDb();
    const uid = seedUser(db);
    const run = startRun("easy", uid);
    insertRun(db, run);
    expect(getActiveRun(db, uid)?.runId).toBe(run.runId);

    run.status = "lost_run";
    saveRun(db, run);
    expect(getActiveRun(db, uid)).toBeNull();
  });

  it("saveRun keeps denormalized columns in sync with the JSON", () => {
    const db = freshDb();
    const uid = seedUser(db);
    const run = startRun("hard", uid);
    insertRun(db, run);

    run.ante = 3;
    run.status = "playing";
    saveRun(db, run);

    const row = db.select().from(gameSessions).where(eq(gameSessions.id, run.runId)).get()!;
    expect(row.status).toBe("playing");
    expect(row.ante).toBe(3);
    expect(row.difficulty).toBe("hard");
  });
});
