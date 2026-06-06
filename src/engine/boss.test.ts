import { describe, expect, it } from "bun:test";
import {
  BOSS_EFFECTS,
  BOSS_EFFECT_BY_ID,
  effectiveBossTargetMult,
  rollBossEffect,
} from "./boss.ts";
import {
  playHand,
  startBlind,
  startRun,
  type RunState,
} from "./run.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";
import { cards } from "../testkit.ts";
import { blindTarget } from "./ante.ts";

/** A deterministic RNG that emits a fixed sequence (loops if exhausted) — keeps Hook deterministic. */
function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function bossRunBase(over: Partial<RunState> = {}): RunState {
  return {
    runId: "test",
    userId: "u",
    difficulty: "easy",
    deckId: "standard",
    deckName: "Standard Deck",
    deckComposition: standardFaces().map(faceCode),
    ante: 1,
    blindIndex: 2,
    money: 0,
    handLevels: defaultHandLevels(),
    jokers: [],
    target: 100,
    totalScore: 0,
    hand: [],
    deck: [],
    handsRemaining: 0,
    discardsRemaining: 0,
    lastPlay: null,
    status: "selecting_blind",
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

describe("BOSS_EFFECTS catalog", () => {
  it("contains the 5 PET-83 entries with unique ids", () => {
    const ids = BOSS_EFFECTS.map((b) => b.id);
    expect(ids).toEqual(["the_needle", "the_wall", "the_hook", "the_wheel", "the_mark"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the_wall declares a 1.5× target multiplier; others default to 1×", () => {
    expect(BOSS_EFFECT_BY_ID.get("the_wall")?.targetMult).toBe(1.5);
    expect(effectiveBossTargetMult("the_wall")).toBe(1.5);
    expect(effectiveBossTargetMult("the_needle")).toBe(1);
    expect(effectiveBossTargetMult("the_hook")).toBe(1);
    expect(effectiveBossTargetMult("the_wheel")).toBe(1);
    expect(effectiveBossTargetMult("the_mark")).toBe(1);
    expect(effectiveBossTargetMult(null)).toBe(1);
  });
});

describe("rollBossEffect", () => {
  it("returns a known catalog id", () => {
    // Math.random ∈ [0,1); pick a deterministic sample.
    const id = rollBossEffect(1, () => 0);
    expect(id).not.toBeNull();
    expect(BOSS_EFFECT_BY_ID.has(id!)).toBe(true);
  });

  it("picks uniformly across the catalog (indexes from rng() × length)", () => {
    // rng=0 → first; rng just under 1 → last.
    expect(rollBossEffect(1, () => 0)).toBe(BOSS_EFFECTS[0]!.id);
    expect(rollBossEffect(1, () => 0.9999)).toBe(BOSS_EFFECTS[BOSS_EFFECTS.length - 1]!.id);
  });
});

describe("the_needle", () => {
  it("startBlind clamps handsRemaining to 1 when current boss effect is the_needle", () => {
    // rng=0 selects index 0 — "the_needle".
    const run = startRun("medium", "u1");
    run.blindIndex = 2; // boss
    startBlind(run, () => 0);
    expect(run.currentBossEffect).toBe("the_needle");
    expect(run.handsRemaining).toBe(1); // medium normally grants 4; clamped to 1.
  });
});

describe("the_wall", () => {
  it("startBlind multiplies the boss-blind target by 1.5", () => {
    // Pick "the_wall" (index 1) deterministically: 1 / 5 = 0.2.
    const run = startRun("medium", "u1");
    run.blindIndex = 2; // boss
    const base = blindTarget(run.ante, 2, run.difficulty); // ante 1 boss medium
    startBlind(run, () => 0.2);
    expect(run.currentBossEffect).toBe("the_wall");
    expect(run.target).toBe(Math.round(base * 1.5));
  });
});

describe("the_hook", () => {
  it("removes 2 random cards from hand after a played hand and redraws", () => {
    // Build a hand of 5, a deck large enough to both refill after score AND fuel the Hook redraw.
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_hook",
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD 2H 4S"),
      handsRemaining: 3,
      target: 9999, // don't transition out of "playing"
    });
    // After scoring removes the 2 K's, hand → 3 + draw 2 from deck → hand=5, deck=2.
    // Then Hook removes 2 random + draws 2 from deck → hand=5, deck=0.
    playHand(run, ["KH", "KS"], seqRng(0, 0));
    expect(run.handsRemaining).toBe(2);
    expect(run.hand.length).toBe(5); // hand size preserved while deck has cards
    expect(run.deck.length).toBe(0); // 2 drawn after score + 2 drawn after hook
  });

  it("Hook caps at deck size: removes up to 2 but only draws what the deck can give", () => {
    // Empty deck after the played hand — Hook still removes 2, draws 0.
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_hook",
      hand: cards("KH KS 3D 7C 9S"),
      deck: [], // empty
      handsRemaining: 3,
      target: 9999,
    });
    playHand(run, ["KH", "KS"], seqRng(0, 0));
    // After scoring: hand becomes 3 cards (KH/KS removed), no redraw possible.
    // After Hook: 2 more removed, no redraw → hand has 1 card.
    expect(run.hand.length).toBe(1);
    expect(run.deck.length).toBe(0);
  });
});

describe("placeholder effects (the_wheel, the_mark)", () => {
  it("are mechanically no-ops at blind start — base target + base hands stay intact", () => {
    // the_wheel index 3 → rng 3/5 = 0.6
    const wheelRun = startRun("medium", "u1");
    wheelRun.blindIndex = 2;
    const baseTarget = blindTarget(wheelRun.ante, 2, wheelRun.difficulty);
    startBlind(wheelRun, () => 0.6);
    expect(wheelRun.currentBossEffect).toBe("the_wheel");
    expect(wheelRun.target).toBe(baseTarget); // no multiplier
    expect(wheelRun.handsRemaining).toBe(4); // medium default — not clamped

    // the_mark index 4 → rng 4/5 = 0.8
    const markRun = startRun("medium", "u1");
    markRun.blindIndex = 2;
    startBlind(markRun, () => 0.8);
    expect(markRun.currentBossEffect).toBe("the_mark");
    expect(markRun.target).toBe(baseTarget);
    expect(markRun.handsRemaining).toBe(4);
  });

  it("placeholder effects do not mutate the hand after a played hand", () => {
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_wheel",
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD"),
      handsRemaining: 3,
      target: 9999,
    });
    playHand(run, ["KH", "KS"]);
    // No Hook applied → standard: removed 2, drew 2.
    expect(run.hand.length).toBe(5);
    expect(run.deck.length).toBe(0);
  });
});
