import { describe, expect, it } from "bun:test";
import {
  GameError,
  playHand,
  skipBlind,
  startRun,
  type RunState,
} from "./run.ts";
import { JOKERS } from "./jokers.ts";
import { cards } from "../testkit.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";
import { TAGS } from "./tags.ts";

function runWith(over: Partial<RunState> & { hand: RunState["hand"] }): RunState {
  return {
    runId: "test",
    userId: "u",
    difficulty: "easy",
    deckId: "standard",
    deckName: "Standard Deck",
    deckComposition: standardFaces().map(faceCode),
    ante: 1,
    blindIndex: 0,
    money: 0,
    handLevels: defaultHandLevels(),
    jokers: [],
    target: 100,
    totalScore: 0,
    deck: [],
    handsRemaining: 3,
    discardsRemaining: 3,
    lastPlay: null,
    status: "playing",
    pendingReward: null,
    pendingRewardBreakdown: null,
    shop: null,
    consumables: [],
    maxConsumables: 2,
    vouchers: [],
    tags: [],
    skipsThisRun: 0,
    currentBossEffect: null,
    jokerStates: {},
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Deterministic rng: returns the supplied value(s) in sequence, then repeats the last. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)]!;
    i += 1;
    return v;
  };
}

function tagIndex(id: string): number {
  const idx = TAGS.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error(`unknown tag: ${id}`);
  return idx;
}

/** Build an rng value that, multiplied by TAGS.length and floored, yields the tag's index. */
function rngForTag(id: string): number {
  return (tagIndex(id) + 0.5) / TAGS.length;
}

describe("TAGS catalog", () => {
  it("populated with the PET-78 seed (10 entries, unique ids)", () => {
    expect(TAGS.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(TAGS.map((t) => t.id));
    expect(ids.size).toBe(TAGS.length);
  });

  it("covers the expected catalog ids", () => {
    const ids = new Set(TAGS.map((t) => t.id));
    for (const id of [
      "investment_tag",
      "voucher_tag",
      "standard_tag",
      "charm_tag",
      "meteor_tag",
      "buffoon_tag",
      "top_up_tag",
      "speed_tag",
      "uncommon_tag",
      "rare_tag",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe("skipBlind", () => {
  it("advances the small blind, awards a tag, and increments skipsThisRun", () => {
    const run = startRun("easy", "u1");
    expect(run.status).toBe("selecting_blind");
    expect(run.blindIndex).toBe(0);

    skipBlind(run, seq(rngForTag("investment_tag")));

    expect(run.blindIndex).toBe(1);
    expect(run.ante).toBe(1);
    expect(run.skipsThisRun).toBe(1);
    expect(run.tags).toEqual(["investment_tag"]);
    expect(run.status).toBe("selecting_blind");
  });

  it("throws on the boss blind (cannot be skipped)", () => {
    const run = startRun("easy", "u1");
    run.blindIndex = 2; // boss
    expect(() => skipBlind(run)).toThrow(GameError);
  });

  it("from the big blind advances to the next ante's small blind", () => {
    const run = startRun("easy", "u1");
    run.blindIndex = 1; // big
    skipBlind(run, seq(rngForTag("standard_tag")));
    expect(run.ante).toBe(2);
    expect(run.blindIndex).toBe(0);
    // Easy ante-2 small target = round(800 × 1 × 0.6) = 480.
    expect(run.target).toBe(480);
  });

  it("only valid from the blind-select screen", () => {
    const run = runWith({ hand: cards("2C"), status: "playing" });
    expect(() => skipBlind(run)).toThrow(GameError);
  });
});

describe("applyTags", () => {
  it("Investment Tag pays out $25 on entering the shop", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
      tags: ["investment_tag"],
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    // cash-out: small base 3 + 2 hands left + 0 interest = $5, plus $25 from the tag.
    expect(run.money).toBe(5 + 25);
    // The tag fired once and was consumed.
    expect(run.tags).toEqual([]);
  });

  it("Speed Tag pays $5 on entering the shop", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
      tags: ["speed_tag"],
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    expect(run.money).toBe(5 + 5);
    expect(run.tags).toEqual([]);
  });

  it("Top-up Tag fires immediately on skip and adds a common joker", () => {
    const run = startRun("easy", "u1");
    expect(run.jokers).toEqual([]);
    // First rng call picks the tag; second picks the joker from the common pool.
    skipBlind(run, seq(rngForTag("top_up_tag"), 0));
    expect(run.skipsThisRun).toBe(1);
    expect(run.jokers.length).toBe(1);
    const owned = run.jokers[0]!;
    const def = JOKERS.find((j) => j.id === owned)!;
    expect(def.rarity).toBe("common");
    // Tag fired and was removed.
    expect(run.tags).toEqual([]);
  });

  it("extra_joker_now tag carries over when the joker slots are full", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
      jokers: ["a", "b", "c", "d", "e"], // 5 jokers = full at MAX_JOKERS
      tags: ["uncommon_tag"],
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    expect(run.jokers.length).toBe(5);
    // Tag persists since there was no room.
    expect(run.tags).toEqual(["uncommon_tag"]);
  });

  it("Uncommon Tag adds a free uncommon joker on shop entry when there is room", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
      jokers: [],
      tags: ["uncommon_tag"],
    });
    // rng feeds checkTransition (shop gen + tag rolls). Drive it with a fixed sequence so
    // the eventual joker pick lands on an uncommon.
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    // The exact joker depends on Math.random in playHand's shop generation; assert the tag
    // either added an uncommon joker or persisted (slots full is impossible here).
    expect(run.tags).toEqual([]);
    expect(run.jokers.length).toBe(1);
    const def = JOKERS.find((j) => j.id === run.jokers[0])!;
    expect(def.rarity).toBe("uncommon");
  });

});
