/**
 * Per-boss effect tests for the PET-92 boss-effect system:
 *   - PET-239 debuff family (exemplar: The Club) — debuffed cards shape the hand but score
 *     nothing and trigger nothing.
 *   - PET-240 restriction/state family (exemplar: The Psychic) + ante-8 finishers.
 * The dispatch PATH is exercised, not just the helpers: startBlind applies, play/discard
 * respect the effect, and the effect clears when the blind is won.
 */

import { describe, expect, it } from "bun:test";
import { BOSS_EFFECTS, isCardDebuffed, rollBossEffect } from "./boss.ts";
import {
  GameError,
  discardCards,
  playHand,
  sellJoker,
  previewSelection,
  startBlind,
  startRun,
  toRunDTO,
  type RunState,
} from "./run.ts";
import { effectiveHandSize } from "./effectives.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";
import { cards } from "../testkit.ts";

function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const REGULAR_POOL = BOSS_EFFECTS.filter((b) => !b.finisher);
const FINISHER_POOL = BOSS_EFFECTS.filter((b) => b.finisher);

/** Constant rng value that makes rollBossEffect pick `id` from the right ante pool. */
function rollFor(id: string, bump = 0.5): number {
  const pool = FINISHER_POOL.some((b) => b.id === id) ? FINISHER_POOL : REGULAR_POOL;
  const idx = pool.findIndex((b) => b.id === id);
  if (idx < 0) throw new Error(`unknown boss: ${id}`);
  return (idx + bump) / pool.length;
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
    target: 9999,
    totalScore: 0,
    hand: [],
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
    jokerEditions: {},
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    nextHandMultBonus: 0,
    freeVoucherPending: false,
    handSizeOffset: 0,
    lastConsumableUsedDefId: null,
    facesPlayedThisAnte: [],
    handTypesPlayedThisBlind: [],
    handTypePlays: {},
    bossForcedCardId: null,
    bossDisabledJoker: null,
    jokerSoldThisBlind: false,
    openingPack: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// PET-239 — debuff family (exemplar: The Club)
// ---------------------------------------------------------------------------

describe("the_club (exemplar) — all clubs debuffed", () => {
  it("debuffed clubs still shape the hand but contribute no chips", () => {
    const run = bossRunBase({
      currentBossEffect: "the_club",
      hand: cards("2C 2D 5D 9H KS"),
      deck: cards("AH 3H"),
    });
    // Pair of 2s where one 2 is a club: still scores as a PAIR (shape kept), but only the
    // non-club 2 contributes chips: (10 base + 2) × 2 = 24 instead of (10 + 2 + 2) × 2 = 28.
    const result = playHand(run, ["2C", "2D"], seqRng(0.9));
    expect(result.breakdown.handType).toBe("pair");
    expect(result.breakdown.scoringChips).toBe(2);
    expect(result.breakdown.score).toBe(24);
  });

  it("an all-clubs hand scores base values only (no card chips, no enhancements)", () => {
    const hand = cards("KC QC 9C 5C 2C");
    hand[0]!.enhancement = "bonus"; // +30 chips — must NOT fire while debuffed
    const run = bossRunBase({ currentBossEffect: "the_club", hand, deck: [] });
    const result = playHand(run, ["KC", "QC", "9C", "5C", "2C"], seqRng(0.9));
    expect(result.breakdown.handType).toBe("flush");
    expect(result.breakdown.scoringChips).toBe(0);
    expect(result.breakdown.score).toBe(35 * 4); // flush base only
  });

  it("preview and play agree under the debuff (no drift)", () => {
    const run = bossRunBase({
      currentBossEffect: "the_club",
      hand: cards("2C 2D 5D 9H KS"),
      deck: [],
    });
    const preview = previewSelection(run, ["2C", "2D"]);
    const played = playHand(run, ["2C", "2D"], seqRng(0.9));
    expect(played.breakdown.score).toBe(preview.score);
  });

  it("toRunDTO stamps debuffed on club cards only — without mutating run.hand", () => {
    const run = bossRunBase({ currentBossEffect: "the_club", hand: cards("2C 5D") });
    const dto = toRunDTO(run);
    expect(dto.hand.find((c) => c.id === "2C")?.debuffed).toBe(true);
    expect(dto.hand.find((c) => c.id === "5D")?.debuffed).toBeUndefined();
    // Server-side hand stays clean — the flag is a view-time overlay.
    expect(run.hand.find((c) => c.id === "2C")?.debuffed).toBeUndefined();
  });
});

describe("debuff_suit variants — the_goad / the_window / the_head", () => {
  it.each([
    ["the_goad", "AS", "AC"],
    ["the_window", "AD", "AC"],
    ["the_head", "AH", "AC"],
  ] as const)("%s debuffs exactly its suit", (boss, debuffedId, cleanId) => {
    const state = { currentBossEffect: boss };
    expect(isCardDebuffed(cards(debuffedId)[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards(cleanId)[0]!, state)).toBe(false);
  });
});

describe("the_plant — face cards debuffed", () => {
  it("debuffs J/Q/K but not aces or numbers, and a face pair scores base only", () => {
    const state = { currentBossEffect: "the_plant" };
    expect(isCardDebuffed(cards("JC")[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards("QD")[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards("KH")[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards("AS")[0]!, state)).toBe(false);
    expect(isCardDebuffed(cards("9C")[0]!, state)).toBe(false);

    const run = bossRunBase({ currentBossEffect: "the_plant", hand: cards("KH KD 2C 3S 5D") });
    const result = playHand(run, ["KH", "KD"], seqRng(0.9));
    expect(result.breakdown.handType).toBe("pair");
    expect(result.breakdown.score).toBe(10 * 2); // no K chips
  });
});

describe("the_pillar — cards played previously this ante debuffed", () => {
  it("debuffs by face code from facesPlayedThisAnte", () => {
    const state = { currentBossEffect: "the_pillar", facesPlayedThisAnte: ["KH", "2C"] };
    expect(isCardDebuffed(cards("KH")[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards("2C")[0]!, state)).toBe(true);
    expect(isCardDebuffed(cards("KS")[0]!, state)).toBe(false);
  });

  it("playHand records played face codes into facesPlayedThisAnte", () => {
    const run = bossRunBase({ hand: cards("KH KS 3D 7C 9S"), deck: [] });
    playHand(run, ["KH", "KS"], seqRng(0.9));
    expect(run.facesPlayedThisAnte).toContain("KH");
    expect(run.facesPlayedThisAnte).toContain("KS");
    expect(run.facesPlayedThisAnte).not.toContain("3D");
  });
});

describe("the_flint — base chips and mult halved", () => {
  it("halves the level-adjusted base values (ceil)", () => {
    const run = bossRunBase({ currentBossEffect: "the_flint", hand: cards("KH KD 2C 3S 5D") });
    const result = playHand(run, ["KH", "KD"], seqRng(0.9));
    expect(result.breakdown.baseChips).toBe(5); // pair 10 → 5
    expect(result.breakdown.baseMult).toBe(1); // pair 2 → 1
    expect(result.breakdown.score).toBe((5 + 20) * 1); // both kings still score chips
  });
});

describe("the_manacle — -1 hand size", () => {
  it("startBlind deals one card fewer while the boss is active", () => {
    const run = startRun("medium", "u1");
    run.blindIndex = 2;
    startBlind(run, () => rollFor("the_manacle"));
    expect(run.currentBossEffect).toBe("the_manacle");
    expect(effectiveHandSize(run)).toBe(7);
    expect(run.hand.length).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// PET-240 — restriction / state family (exemplar: The Psychic)
// ---------------------------------------------------------------------------

describe("the_psychic (exemplar) — must play 5 cards", () => {
  it("rejects any play that isn't exactly 5 cards, before mutating anything", () => {
    const run = bossRunBase({ currentBossEffect: "the_psychic", hand: cards("KH KS 3D 7C 9S") });
    expect(() => playHand(run, ["KH", "KS"], seqRng(0.9))).toThrow(GameError);
    expect(run.handsRemaining).toBe(3); // nothing consumed by the rejected play
    expect(run.hand.length).toBe(5);
  });

  it("accepts a 5-card play", () => {
    const run = bossRunBase({ currentBossEffect: "the_psychic", hand: cards("KH KS 3D 7C 9S") });
    const result = playHand(run, ["KH", "KS", "3D", "7C", "9S"], seqRng(0.9));
    expect(result.breakdown.handType).toBe("pair");
    expect(run.handsRemaining).toBe(2);
  });
});

describe("the_eye — no repeat hand types this blind", () => {
  it("rejects a repeated hand type; a fresh type is fine", () => {
    const run = bossRunBase({
      currentBossEffect: "the_eye",
      hand: cards("KH KD QS QC 9S"),
      deck: cards("2H 3H 4H 5H"),
    });
    playHand(run, ["KH", "KD"], seqRng(0.9)); // pair
    expect(() => playHand(run, ["QS", "QC"], seqRng(0.9))).toThrow(GameError); // pair again
    playHand(run, ["9S"], seqRng(0.9)); // high card — different type, allowed
    expect(run.handTypesPlayedThisBlind).toEqual(["pair", "high_card"]);
  });
});

describe("the_mouth — only one hand type this blind", () => {
  it("locks the blind to the first played hand type", () => {
    const run = bossRunBase({
      currentBossEffect: "the_mouth",
      hand: cards("KH KD QS QC 9S"),
      deck: cards("2H 3H 4H 5H"),
    });
    playHand(run, ["KH", "KD"], seqRng(0.9)); // pair locks the blind
    expect(() => playHand(run, ["9S"], seqRng(0.9))).toThrow(GameError); // high card rejected
    playHand(run, ["QS", "QC"], seqRng(0.9)); // another pair is allowed
    expect(run.handTypesPlayedThisBlind).toEqual(["pair", "pair"]);
  });
});

describe("the_arm — level down the played hand", () => {
  it("levels the played type down before scoring (and floors at 1)", () => {
    const run = bossRunBase({ currentBossEffect: "the_arm", hand: cards("KH KD 2C 3S 5D") });
    run.handLevels.pair = 3;
    const result = playHand(run, ["KH", "KD"], seqRng(0.9));
    expect(run.handLevels.pair).toBe(2);
    expect(result.breakdown.handLevel).toBe(2); // scored at the lowered level

    const floored = bossRunBase({ currentBossEffect: "the_arm", hand: cards("9H 9D 2C 3S 5D") });
    playHand(floored, ["9H", "9D"], seqRng(0.9));
    expect(floored.handLevels.pair).toBe(1);
  });
});

describe("the_ox — playing the most played hand sets money to $0", () => {
  it("fires only when the played type is the run's most played", () => {
    const run = bossRunBase({
      currentBossEffect: "the_ox",
      hand: cards("KH KD 9S 2C 3D"),
      deck: cards("4H 5H 6H"),
      money: 10,
      handTypePlays: { pair: 2, high_card: 1 },
    });
    playHand(run, ["9S"], seqRng(0.9)); // high_card count 1 < max 2 → money untouched
    expect(run.money).toBe(10);
    playHand(run, ["KH", "KD"], seqRng(0.9)); // pair IS the most played → $0
    expect(run.money).toBe(0);
  });
});

describe("the_water — 0 discards", () => {
  it("startBlind grants no discards and discarding throws", () => {
    const run = startRun("medium", "u1");
    run.blindIndex = 2;
    startBlind(run, () => rollFor("the_water"));
    expect(run.currentBossEffect).toBe("the_water");
    expect(run.discardsRemaining).toBe(0);
    expect(() => discardCards(run, [run.hand[0]!.id])).toThrow(GameError);
  });
});

describe("the_serpent — always draw exactly 3 after play/discard", () => {
  it("draws 3 (not a refill to hand size) after a play and after a discard", () => {
    const run = bossRunBase({
      currentBossEffect: "the_serpent",
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD 2H 4S 5C 6D 7H 8S"),
    });
    playHand(run, ["KH", "KS"], seqRng(0.9)); // 5 − 2 + 3 = 6 (a plain refill would draw 5)
    expect(run.hand.length).toBe(6);
    expect(run.deck.length).toBe(5);
    discardCards(run, [run.hand[0]!.id], seqRng(0.9)); // 6 − 1 + 3 = 8
    expect(run.hand.length).toBe(8);
    expect(run.deck.length).toBe(2);
  });
});

describe("the_fish — cards drawn face-down after each hand played", () => {
  it("flips replenish draws after a play, but not draws before any play", () => {
    const run = bossRunBase({
      currentBossEffect: "the_fish",
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD 2H 4S 5C"),
      discardsRemaining: 2,
      handSizeOffset: -3, // effective hand size 5 — refills draw exactly what was removed
    });
    discardCards(run, ["3D"], seqRng(0.9)); // pre-play draw (AC) stays face-up
    expect(run.hand.find((c) => c.id === "AC")?.faceDown).toBeFalsy();
    playHand(run, ["KH", "KS"], seqRng(0.9)); // post-play draws (AD, 2H) are face-down
    const ad = run.hand.find((c) => c.id === "AD");
    const twoH = run.hand.find((c) => c.id === "2H");
    expect(ad?.faceDown).toBe(true);
    expect(twoH?.faceDown).toBe(true);
  });
});

describe("the_house — first hand dealt face-down", () => {
  it("deals the entire opening hand face-down; later draws are face-up", () => {
    const run = startRun("medium", "u1");
    run.blindIndex = 2;
    startBlind(run, () => rollFor("the_house"));
    expect(run.currentBossEffect).toBe("the_house");
    expect(run.hand.every((c) => c.faceDown)).toBe(true);
    // A pre-play discard draw is NOT the first hand — cards come up face-up.
    const firstId = run.hand[0]!.id;
    discardCards(run, [firstId], () => 0.9);
    const drawn = run.hand[run.hand.length - 1]!;
    expect(drawn.faceDown).toBeFalsy();
  });
});

describe("the_tooth — lose $1 per card played", () => {
  it("subtracts per played card, floored at $0", () => {
    const run = bossRunBase({
      currentBossEffect: "the_tooth",
      hand: cards("KH KS 3D 7C 9S"),
      deck: [],
      money: 10,
    });
    playHand(run, ["KH", "KS", "3D"], seqRng(0.9));
    expect(run.money).toBe(7);

    const broke = bossRunBase({
      currentBossEffect: "the_tooth",
      hand: cards("KH KS 3D 7C 9S"),
      deck: [],
      money: 1,
    });
    playHand(broke, ["KH", "KS", "3D", "7C", "9S"], seqRng(0.9));
    expect(broke.money).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PET-240 — ante-8 finishers
// ---------------------------------------------------------------------------

describe("finisher gating", () => {
  it("regular antes never roll a finisher; the final ante always does", () => {
    for (const r of [0, 0.3, 0.7, 0.9999]) {
      const regular = rollBossEffect(3, () => r)!;
      const finisher = rollBossEffect(8, () => r)!;
      expect(FINISHER_POOL.some((b) => b.id === regular)).toBe(false);
      expect(FINISHER_POOL.some((b) => b.id === finisher)).toBe(true);
    }
  });
});

describe("amber_acorn — shuffles joker order", () => {
  it("startBlind reorders the same joker multiset", () => {
    const run = bossRunBase({
      status: "selecting_blind",
      ante: 8,
      jokers: ["joker", "greedy_joker", "lusty_joker"],
    });
    startBlind(run, () => rollFor("amber_acorn"));
    expect(run.currentBossEffect).toBe("amber_acorn");
    expect([...run.jokers].sort()).toEqual(["greedy_joker", "joker", "lusty_joker"]);
  });
});

describe("verdant_leaf — all cards debuffed until a joker is sold", () => {
  it("debuffs everything, then releases when a joker is sold this blind", () => {
    const run = bossRunBase({
      currentBossEffect: "verdant_leaf",
      ante: 8,
      jokers: ["joker"],
      hand: cards("KH KD 2C 3S 5D"),
      deck: cards("AH 4H"),
    });
    const before = playHand(run, ["KH", "KD"], seqRng(0.9));
    expect(before.breakdown.scoringChips).toBe(0); // everything debuffed
    sellJoker(run, "joker");
    expect(run.jokerSoldThisBlind).toBe(true);
    const dto = toRunDTO(run);
    for (const c of dto.hand) expect(c.debuffed).toBeUndefined(); // debuff released
  });
});

describe("crimson_heart — one random joker disabled every hand", () => {
  it("excludes the disabled joker from scoring and repicks after each hand", () => {
    const run = bossRunBase({
      currentBossEffect: "crimson_heart",
      ante: 8,
      jokers: ["joker", "greedy_joker"],
      bossDisabledJoker: "joker",
      hand: cards("KH KD 2C 3S 5D"),
      deck: cards("AH 4H"),
    });
    const result = playHand(run, ["KH", "KD"], seqRng(0.9));
    // "joker" (+4 mult) is disabled — no step for it in the fold.
    expect(result.breakdown.jokerSteps.some((s) => s.jokerId === "joker")).toBe(false);
    // Repicked post-hand: still one of the owned jokers.
    expect(run.jokers).toContain(run.bossDisabledJoker!);
    // Surfaced on the DTO so the FE can grey it out.
    const dto = toRunDTO(run);
    expect(dto.jokers.find((j) => j.id === run.bossDisabledJoker)?.disabled).toBe(true);
  });
});

describe("cerulean_bell — one card forced into every selection", () => {
  it("startBlind picks a forced card from the dealt hand", () => {
    const run = bossRunBase({ status: "selecting_blind", ante: 8 });
    startBlind(run, () => rollFor("cerulean_bell"));
    expect(run.currentBossEffect).toBe("cerulean_bell");
    expect(run.bossForcedCardId).not.toBeNull();
    expect(run.hand.some((c) => c.id === run.bossForcedCardId)).toBe(true);
    expect(toRunDTO(run).bossForcedCardId).toBe(run.bossForcedCardId!);
  });

  it("plays and discards must include the forced card; it repicks after leaving the hand", () => {
    const run = bossRunBase({
      currentBossEffect: "cerulean_bell",
      ante: 8,
      hand: cards("KH KS 3D 7C 9S"),
      deck: cards("AC AD 2H"),
      bossForcedCardId: "KH",
    });
    expect(() => playHand(run, ["KS", "9S"], seqRng(0.9))).toThrow(GameError);
    expect(() => discardCards(run, ["3D"], seqRng(0.9))).toThrow(GameError);
    playHand(run, ["KH", "KS"], seqRng(0.9)); // forced card included — legal
    // KH left the hand → a new forced card was picked from what remains.
    expect(run.bossForcedCardId).not.toBe("KH");
    expect(run.hand.some((c) => c.id === run.bossForcedCardId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Effect lifecycle — clears when the blind is won
// ---------------------------------------------------------------------------

describe("boss effect lifecycle", () => {
  it("winning the blind clears the boss effect and its transient state", () => {
    const run = bossRunBase({
      currentBossEffect: "the_club",
      hand: cards("KH KD 2C 3S 5D"),
      deck: [],
      target: 20, // pair of kings (24) clears it
      bossForcedCardId: "KH",
      bossDisabledJoker: "joker",
    });
    playHand(run, ["KH", "KD"], seqRng(0.9));
    expect(run.status).toBe("shop");
    expect(run.currentBossEffect).toBeNull();
    expect(run.bossForcedCardId).toBeNull();
    expect(run.bossDisabledJoker).toBeNull();
    expect(toRunDTO(run).bossEffect).toBeNull();
  });
});
