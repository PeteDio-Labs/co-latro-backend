import { describe, expect, it } from "bun:test";
import {
  BOSS_EFFECTS,
  BOSS_EFFECT_BY_ID,
  applyFaceDownEffect,
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
    jokerEditions: {},
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    nextHandMultBonus: 0,
    freeVoucherPending: false,
    handSizeOffset: 0,
    lastConsumableUsedDefId: null,
    openingPack: null,
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

describe("the_wheel + the_mark — base target / hands untouched", () => {
  it("leave the boss-blind target and hands-remaining at the defaults", () => {
    // the_wheel index 3 → rng 3/5 = 0.6
    const wheelRun = startRun("medium", "u1");
    wheelRun.blindIndex = 2;
    const baseTarget = blindTarget(wheelRun.ante, 2, wheelRun.difficulty);
    // Constant rng = 0.6: shuffle/rolls all return 0.6, which (>1/7) never triggers
    // applyFaceDownEffect's wheel flip but still selects boss index 3 (the_wheel).
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
});

describe("the_wheel — 1-in-7 face-down on deal + redraw", () => {
  it("flips the FIRST dealt card face-down when the first rng() roll lands under 1/7", () => {
    // 1/7 ≈ 0.1428. After startBlind() rolls the boss effect (idx 3/5 = 0.6), and rolls
    // the shuffle (HAND_SIZE × deck.length pulls inside shuffle), applyFaceDownEffect
    // walks the freshly-dealt 8-card hand. We can't get to "first card flips" cleanly
    // via the normal startBlind path because shuffle eats the leading rng values; instead
    // drive applyFaceDownEffect directly with a controlled seq.
    const wheelRun = bossRunBase({
      status: "playing",
      currentBossEffect: "the_wheel",
      hand: cards("KH KS 3D 7C 9S"),
    });
    // First roll < 1/7 → card[0] flips; remaining six rolls are > 1/7 → no flip.
    applyFaceDownEffectViaDraw(wheelRun, seqRng(0.05, 0.9, 0.9, 0.9, 0.9));
    expect(wheelRun.hand[0]!.faceDown).toBe(true);
    expect(wheelRun.hand[1]!.faceDown).toBeFalsy();
    expect(wheelRun.hand[4]!.faceDown).toBeFalsy();
  });

  it("applies to cards drawn on the discard/play replenish (so Hook + Wheel interact)", () => {
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_wheel",
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD"),
      handsRemaining: 3,
      target: 9999,
    });
    // Play KH+KS — 2 cards drawn from the deck; force both rolls < 1/7 → both face-down.
    // Hook is NOT active here so we only get the 2 standard replenish cards.
    playHand(run, ["KH", "KS"], seqRng(0.01, 0.01));
    expect(run.hand.length).toBe(5);
    // The two new cards (AC, AD) are at the END of run.hand (KH/KS removed from front).
    const ac = run.hand.find((c) => c.id === "AC");
    const ad = run.hand.find((c) => c.id === "AD");
    expect(ac?.faceDown).toBe(true);
    expect(ad?.faceDown).toBe(true);
  });
});

describe("the_mark — every face card dealt face-down", () => {
  it("flips J/Q/K cards face-down and leaves number / ace cards face-up", () => {
    const markRun = bossRunBase({
      status: "playing",
      currentBossEffect: "the_mark",
      hand: cards("KH QS JD AH 2C 9S"),
    });
    applyFaceDownEffectViaDraw(markRun, () => 0); // rng unused for the_mark
    expect(markRun.hand.find((c) => c.id === "KH")?.faceDown).toBe(true);
    expect(markRun.hand.find((c) => c.id === "QS")?.faceDown).toBe(true);
    expect(markRun.hand.find((c) => c.id === "JD")?.faceDown).toBe(true);
    expect(markRun.hand.find((c) => c.id === "AH")?.faceDown).toBeFalsy(); // Ace is not a face
    expect(markRun.hand.find((c) => c.id === "2C")?.faceDown).toBeFalsy();
    expect(markRun.hand.find((c) => c.id === "9S")?.faceDown).toBeFalsy();
  });

  it("startBlind on a boss blind with the_mark flips every face card in the dealt hand", () => {
    const markRun = startRun("medium", "u1");
    markRun.blindIndex = 2; // boss
    startBlind(markRun, () => 0.8); // index 4/5 → the_mark
    expect(markRun.currentBossEffect).toBe("the_mark");
    const faceDownCount = markRun.hand.filter((c) => c.faceDown).length;
    const expectedFaces = markRun.hand.filter((c) => c.rank >= 11 && c.rank <= 13).length;
    expect(faceDownCount).toBe(expectedFaces);
    // Sanity: no non-face card got flipped.
    for (const c of markRun.hand) {
      if (c.faceDown) expect(c.rank >= 11 && c.rank <= 13).toBe(true);
    }
  });

  it("a face card drawn on play replenish is also flipped face-down", () => {
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_mark",
      hand: cards("2C 3D 4H 5S 6C"),
      deck: cards("KH 7D"), // KH is a face, 7D isn't
      handsRemaining: 3,
      target: 9999,
    });
    playHand(run, ["2C"]); // 1 card drawn → KH
    const kh = run.hand.find((c) => c.id === "KH");
    expect(kh?.faceDown).toBe(true);
    // Existing non-face cards in hand remain face-up.
    expect(run.hand.find((c) => c.id === "3D")?.faceDown).toBeFalsy();
  });
});

describe("face-down cards — play resolution", () => {
  it("are revealed in lastPlay.playedCards (faceDown flipped to false)", () => {
    const run = bossRunBase({
      status: "playing",
      currentBossEffect: "the_mark",
      hand: [
        { id: "KH", rank: 13, suit: "hearts", faceDown: true },
        { id: "QS", rank: 12, suit: "spades", faceDown: true },
        { id: "3D", rank: 3, suit: "diamonds" },
        { id: "7C", rank: 7, suit: "clubs" },
        { id: "9S", rank: 9, suit: "spades" },
      ],
      deck: [],
      handsRemaining: 3,
      target: 9999,
    });
    const result = playHand(run, ["KH", "QS"]);
    // The played-card array has both cards revealed (faceDown === undefined or false).
    expect(result.playedCards.map((c) => c.id)).toEqual(["KH", "QS"]);
    for (const c of result.playedCards) expect(c.faceDown).toBeFalsy();
    // And the persisted lastPlay mirrors that.
    for (const c of run.lastPlay!.playedCards) expect(c.faceDown).toBeFalsy();
  });
});

/** Direct alias — exercises the boss helper the same way draw()/startBlind do. */
function applyFaceDownEffectViaDraw(run: RunState, rng: () => number): void {
  applyFaceDownEffect(run.hand, run.currentBossEffect, rng);
}
