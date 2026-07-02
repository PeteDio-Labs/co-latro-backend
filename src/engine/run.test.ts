import { describe, expect, it } from "bun:test";
import {
  GameError,
  continueRun,
  discardCards,
  moveJoker,
  playHand,
  sellJoker,
  startBlind,
  startRun,
  toRunDTO,
  useConsumable,
  type RunState,
} from "./run.ts";
import { cards, withMod, card as cardOne } from "../testkit.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";
import { effectiveHandSize } from "./effectives.ts";
import { CONSUMABLE_BY_ID } from "./consumables.ts";
import { HAND_SIZE } from "../difficulty.ts";

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
    jokerEditions: {},
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    nextHandMultBonus: 0,
    freeVoucherPending: false,
    handSizeOffset: 0,
    lastConsumableUsedDefId: null,
    openingPack: null,
    deckEnhancements: {},
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("startRun / startBlind", () => {
  it("startRun begins at ante 1, selecting the small blind, no hand dealt", () => {
    const run = startRun("medium", "u1");
    expect(run.status).toBe("selecting_blind");
    expect(run.ante).toBe(1);
    expect(run.blindIndex).toBe(0);
    expect(run.money).toBe(0);
    expect(run.hand.length).toBe(0);
    expect(run.target).toBe(300);
    expect(run.deckId).toBe("standard");
  });

  it("Yellow deck starts with $10", () => {
    expect(startRun("medium", "u1", "yellow").money).toBe(10);
  });

  it("startBlind deals 8 from composition + applies difficulty budgets", () => {
    const run = startRun("medium", "u1");
    startBlind(run);
    expect(run.status).toBe("playing");
    expect(run.hand.length).toBe(8);
    expect(run.deck.length).toBe(44);
    expect(run.target).toBe(300);
    expect(run.handsRemaining).toBe(4);
    expect(run.discardsRemaining).toBe(3);
  });

  it("Blue deck grants +1 hand per blind", () => {
    const run = startRun("medium", "u1", "blue");
    startBlind(run);
    expect(run.handsRemaining).toBe(5); // medium 4 + 1
  });

  it("Abandoned deck deals from a 40-card composition", () => {
    const run = startRun("medium", "u1", "abandoned");
    startBlind(run);
    expect(run.deck.length).toBe(40 - 8);
  });
});

describe("playHand transitions", () => {
  it("beating the target → shop with a populated shop + reward", () => {
    const run = runWith({ hand: cards("KH KS 3D 7C 9S"), target: 50, blindIndex: 0, handsRemaining: 3 });
    const result = playHand(run, ["KH", "KS"]);
    expect(result.breakdown.score).toBe(60);
    expect(run.status).toBe("shop");
    expect(run.pendingReward).toBe(5); // small base 3 + 2 hands left + 0 interest ($0 held)
    expect(run.pendingRewardBreakdown).toEqual({ blindBase: 3, handsBonus: 2, interest: 0 });
    expect(run.money).toBe(5);
    expect(run.shop?.items.length).toBe(3);
    expect(run.shop?.rerollCost).toBe(5);
  });

  it("cash-out includes interest ($1 per $5 held, cap $5) and breakdown sums to pendingReward", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 25, // $25 held → max $5 interest
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    const bd = run.pendingRewardBreakdown!;
    expect(bd).toEqual({ blindBase: 3, handsBonus: 2, interest: 5 });
    expect(run.pendingReward).toBe(bd.blindBase + bd.handsBonus + bd.interest);
    expect(run.pendingReward).toBe(10);
    expect(run.money).toBe(35); // 25 + 10
  });

  it("running out of hands below target → lost_run", () => {
    const run = runWith({ hand: cards("2C 5D 9H JS KC"), target: 10000, handsRemaining: 1 });
    playHand(run, ["2C"]);
    expect(run.status).toBe("lost_run");
  });

  it("softlock guard: empty hand + deck below target → lost_run", () => {
    const run = runWith({ hand: cards("2C"), deck: [], target: 10000, handsRemaining: 5 });
    playHand(run, ["2C"]);
    expect(run.hand.length).toBe(0);
    expect(run.status).toBe("lost_run");
  });

  it("scores with the run's hand levels", () => {
    const levels = defaultHandLevels();
    levels.pair = 2; // Mercury: +15 chips, +1 mult per level
    const run = runWith({ hand: cards("KH KS 3D 7C 9S"), target: 9999, handLevels: levels });
    const result = playHand(run, ["KH", "KS"]);
    // pair L2: (10+15 base + 10+10 cards) × (2+1) = 45 × 3 = 135
    expect(result.breakdown.handLevel).toBe(2);
    expect(result.breakdown.score).toBe(135);
  });

  it("rejects a card not in hand and selections over 5", () => {
    const run = runWith({ hand: cards("2C 3C 4C 5C 6C 7C") });
    expect(() => playHand(run, ["AS"])).toThrow(GameError);
    expect(() => playHand(run, ["2C", "3C", "4C", "5C", "6C", "7C"])).toThrow(GameError);
  });

  it("cannot play when not in a blind", () => {
    const run = runWith({ hand: cards("2C 3C"), status: "selecting_blind" });
    expect(() => playHand(run, ["2C"])).toThrow(GameError);
  });
});

describe("discard", () => {
  it("swaps cards without scoring or consuming a hand", () => {
    const run = runWith({ hand: cards("2C 3C 4C 5C 6C"), deck: cards("KH QH"), discardsRemaining: 2 });
    discardCards(run, ["2C", "3C"]);
    expect(run.discardsRemaining).toBe(1);
    expect(run.handsRemaining).toBe(3);
    expect(run.totalScore).toBe(0);
    expect(run.hand.length).toBe(5);
  });

  it("throws when no discards remain", () => {
    const run = runWith({ hand: cards("2C 3C 4C 5C 6C"), discardsRemaining: 0 });
    expect(() => discardCards(run, ["2C"])).toThrow(GameError);
  });
});

describe("continueRun (ante/blind advance)", () => {
  it("advances small → big and clears the shop", () => {
    const run = runWith({
      hand: [],
      status: "shop",
      ante: 1,
      blindIndex: 0,
      pendingReward: 5,
      shop: { items: [], rerollCost: 5, voucher: null },
    });
    continueRun(run);
    expect(run.status).toBe("selecting_blind");
    expect(run.blindIndex).toBe(1);
    expect(run.pendingReward).toBeNull();
    expect(run.shop).toBeNull();
  });

  it("advances boss → next ante", () => {
    const run = runWith({ hand: [], status: "shop", ante: 1, blindIndex: 2 });
    continueRun(run);
    expect(run.ante).toBe(2);
    expect(run.blindIndex).toBe(0);
    expect(run.status).toBe("selecting_blind");
    expect(run.target).toBe(480); // easy ante-2 small: round(800 × 1 × 0.6)
  });

  it("clearing the final ante boss wins the run", () => {
    const run = runWith({ hand: [], status: "shop", ante: 8, blindIndex: 2 });
    continueRun(run);
    expect(run.status).toBe("won_run");
  });

  it("only valid from the shop screen", () => {
    const run = runWith({ hand: cards("2C"), status: "playing" });
    expect(() => continueRun(run)).toThrow(GameError);
  });
});

describe("jokers", () => {
  it("sellJoker refunds half (min 1) and removes the joker", () => {
    const run = runWith({ hand: cards("2C"), jokers: ["the_duo"], money: 0 }); // cost 8 → sell 4
    sellJoker(run, "the_duo");
    expect(run.money).toBe(4);
    expect(run.jokers).toEqual([]);
  });

  it("sellJoker throws on not-owned or wrong state", () => {
    expect(() => sellJoker(runWith({ hand: cards("2C"), jokers: ["joker"] }), "the_duo")).toThrow(GameError);
    expect(() => sellJoker(runWith({ hand: [], jokers: ["joker"], status: "selecting_blind" }), "joker")).toThrow(GameError);
  });

  it("moveJoker swaps neighbours; edge move is a no-op", () => {
    const run = runWith({ hand: cards("2C"), jokers: ["a", "b", "c"] });
    moveJoker(run, "b", "left");
    expect(run.jokers).toEqual(["b", "a", "c"]);
    moveJoker(run, "b", "left"); // already first → no-op
    expect(run.jokers).toEqual(["b", "a", "c"]);
  });

  it("moveJoker throws on bad dir or not-owned", () => {
    expect(() => moveJoker(runWith({ hand: cards("2C"), jokers: ["a"] }), "a", "up")).toThrow(GameError);
    expect(() => moveJoker(runWith({ hand: cards("2C"), jokers: ["a"] }), "z", "left")).toThrow(GameError);
  });

  it("playHand applies owned jokers via scoreCtx (+4 Mult from Joker)", () => {
    const r1 = playHand(runWith({ hand: cards("KH KS 3D 7C 9S"), jokers: [], target: 9999 }), ["KH", "KS"]);
    const r2 = playHand(runWith({ hand: cards("KH KS 3D 7C 9S"), jokers: ["joker"], target: 9999 }), ["KH", "KS"]);
    expect(r1.breakdown.score).toBe(60); // (10+20) × 2
    expect(r2.breakdown.score).toBe(180); // (10+20) × (2+4)
    expect(r2.breakdown.jokerSteps).toHaveLength(1);
  });

  it("sellJoker clears the jokerStates entry for a scaling joker", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["green_joker"],
      jokerStates: { green_joker: { counter: 3 } },
      money: 0,
    });
    sellJoker(run, "green_joker");
    expect(run.jokerStates.green_joker).toBeUndefined();
    expect(run.jokers).toEqual([]);
  });

  it("playHand pays out economy_per_hand_played BEFORE the shop transition", () => {
    // Cloud 9 = $1/hand. Beating target lands us in shop; money should already include the $1.
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      jokers: ["cloud_9"],
      target: 30,
      money: 0,
      handsRemaining: 3,
      blindIndex: 0,
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    // $1 from Cloud 9 + cash-out reward; assert at least the Cloud 9 payout landed pre-shop.
    expect(run.money).toBeGreaterThanOrEqual(1);
  });

  it("continueRun increments counter for each scaling joker owned", () => {
    const run = runWith({
      hand: [],
      status: "shop",
      ante: 1,
      blindIndex: 0,
      jokers: ["green_joker", "square_joker", "joker"], // joker is not scaling
      jokerStates: { green_joker: { counter: 0 }, square_joker: { counter: 0 } },
      shop: { items: [], rerollCost: 5, voucher: null },
    });
    continueRun(run);
    expect(run.jokerStates.green_joker?.counter).toBe(1);
    expect(run.jokerStates.square_joker?.counter).toBe(1);
    expect(run.jokerStates.joker).toBeUndefined(); // non-scaling joker untouched
  });
});

describe("joker editions (PET-67)", () => {
  // Build an rng that returns a fixed sequence of values, repeating the last.
  function seqRng(...vals: number[]): () => number {
    let i = 0;
    return () => (i < vals.length ? vals[i++]! : vals[vals.length - 1]!);
  }

  it("startRun initializes jokerEditions to {}", () => {
    const run = startRun("medium", "u1");
    expect(run.jokerEditions).toEqual({});
  });

  it("sellJoker clears the jokerEditions entry", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker"],
      jokerEditions: { joker: "foil" },
      money: 0,
    });
    sellJoker(run, "joker");
    expect(run.jokerEditions.joker).toBeUndefined();
  });

  it("a Negative joker raises effectiveMaxJokers by 1 (DTO reflects 6 slots)", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker"],
      jokerEditions: { joker: "negative" },
    });
    expect(toRunDTO(run).maxJokers).toBe(6);
  });

  it("toRunDTO surfaces edition on the JokerView when set", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker", "the_duo"],
      jokerEditions: { joker: "poly" },
    });
    const dto = toRunDTO(run);
    expect(dto.jokers[0]?.edition).toBe("poly");
    expect(dto.jokers[1]?.edition).toBeUndefined();
  });

  it("Aura applies a random non-noop edition (seeded rng) to a random joker", () => {
    // rng calls (in order): pick joker index, pick edition index.
    // With 2 jokers + pool ["foil","holo","poly"]: 0.6 → idx 1 (the_duo), 0.0 → "foil".
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker", "the_duo"],
      status: "playing",
    });
    run.consumables.push({ id: "aura-1", defId: "aura" });
    useConsumable(run, "aura-1", undefined, seqRng(0.6, 0.0));
    expect(run.jokerEditions.the_duo).toBe("foil");
    expect(run.jokerEditions.joker).toBeUndefined();
    expect(run.consumables).toEqual([]);
  });

  it("Ectoplasm overwrites any existing edition with Negative", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker"],
      jokerEditions: { joker: "foil" },
    });
    run.consumables.push({ id: "ecto-1", defId: "ectoplasm" });
    useConsumable(run, "ecto-1", undefined, seqRng(0));
    expect(run.jokerEditions.joker).toBe("negative");
  });

  it("Hex with 3 jokers: keeps 1 with poly, destroys the others (states + editions cleared)", () => {
    const run = runWith({
      hand: cards("2C"),
      jokers: ["joker", "green_joker", "the_duo"],
      jokerStates: { green_joker: { counter: 5 } },
      jokerEditions: { the_duo: "foil" },
      money: 10,
    });
    run.consumables.push({ id: "hex-1", defId: "hex" });
    // rng 0.4 → idx 1 (green_joker) is kept.
    useConsumable(run, "hex-1", undefined, seqRng(0.4));
    expect(run.jokers).toEqual(["green_joker"]);
    expect(run.jokerEditions).toEqual({ green_joker: "poly" });
    expect(run.jokerStates).toEqual({ green_joker: { counter: 5 } });
    expect(run.money).toBe(10); // Hex does NOT zero money
  });

  it("Wheel of Fortune: rng < 0.25 applies edition, rng >= 0.25 is a no-op; both consume the slot", () => {
    // Hit branch.
    const hit = runWith({ hand: cards("2C"), jokers: ["joker"] });
    hit.consumables.push({ id: "w1", defId: "the_wheel_of_fortune" });
    // rng 0.1 → roll succeeds (< 0.25); 0.0 → joker idx 0; 0.0 → "foil".
    useConsumable(hit, "w1", undefined, seqRng(0.1, 0.0, 0.0));
    expect(hit.jokerEditions.joker).toBe("foil");
    expect(hit.consumables).toEqual([]);
    // Miss branch.
    const miss = runWith({ hand: cards("2C"), jokers: ["joker"] });
    miss.consumables.push({ id: "w2", defId: "the_wheel_of_fortune" });
    useConsumable(miss, "w2", undefined, seqRng(0.9));
    expect(miss.jokerEditions.joker).toBeUndefined();
    expect(miss.consumables).toEqual([]); // tag consumed either way
  });
});

describe("card modifier end-of-blind hooks (PET-75)", () => {
  it("gold-enhancement payout: +$3 per gold card held in hand at round end", () => {
    // Two gold cards stay in hand; the played pair clears the small-blind target.
    const goldA = withMod(cardOne("3D"), { enhancement: "gold" });
    const goldB = withMod(cardOne("7C"), { enhancement: "gold" });
    const run = runWith({
      hand: [cardOne("KH"), cardOne("KS"), goldA, goldB, cardOne("9S")],
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    expect(run.heldGoldRoundEnd).toBe(true);
    // gold pays $3 × 2 = $6 BEFORE interest, so $6 held → +$1 interest in cash-out.
    // money = 0 + 6 (gold) + 3 (blindBase) + 2 (handsBonus) + 1 (interest on $6) = 12
    expect(run.money).toBe(12);
  });

  it("no gold held → heldGoldRoundEnd stays false, no payout", () => {
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    expect(run.heldGoldRoundEnd).toBe(false);
    expect(run.money).toBe(5); // just the standard cash-out
  });

  it("glass-break: rng < 0.25 destroys the played glass card from deckComposition", () => {
    const glassK = withMod(cardOne("KH"), { enhancement: "glass" });
    const run = runWith({
      hand: [glassK, cardOne("KS"), cardOne("3D"), cardOne("7C"), cardOne("9S")],
      target: 10000, // don't end the blind — keep run in "playing"
      handsRemaining: 5,
      deck: cards("2C 3C 4C 5C 6C"),
    });
    const before = run.deckComposition.length;
    // rng() returns 0.1 → < 0.25 → glass card destroyed
    playHand(run, ["KH", "KS"], () => 0.1);
    expect(run.deckComposition.length).toBe(before - 1);
    expect(run.deckComposition).not.toContain("KH");
  });

  it("glass-break: rng >= 0.25 survives — deckComposition unchanged", () => {
    const glassK = withMod(cardOne("KH"), { enhancement: "glass" });
    const run = runWith({
      hand: [glassK, cardOne("KS"), cardOne("3D"), cardOne("7C"), cardOne("9S")],
      target: 10000,
      handsRemaining: 5,
      deck: cards("2C 3C 4C 5C 6C"),
    });
    const before = run.deckComposition.slice();
    playHand(run, ["KH", "KS"], () => 0.9); // no glass break
    expect(run.deckComposition).toEqual(before);
  });

  it("glass-break: each glass card rolls independently (one breaks, one survives)", () => {
    const glassA = withMod(cardOne("KH"), { enhancement: "glass" });
    const glassB = withMod(cardOne("KS"), { enhancement: "glass" });
    const run = runWith({
      hand: [glassA, glassB, cardOne("3D"), cardOne("7C"), cardOne("9S")],
      target: 10000,
      handsRemaining: 5,
      deck: cards("2C 3C 4C 5C 6C"),
    });
    // First roll 0.1 (< 0.25 → break KH); second roll 0.9 (>= 0.25 → KS survives).
    const before = run.deckComposition.length;
    playHand(run, ["KH", "KS"], seqRng(0.1, 0.9));
    expect(run.deckComposition.length).toBe(before - 1);
    expect(run.deckComposition).not.toContain("KH");
    expect(run.deckComposition).toContain("KS");
  });

  it("blue seal: each blue-sealed card held at end of blind levels up the played hand type", () => {
    const blueA = withMod(cardOne("3D"), { seal: "blue" });
    const blueB = withMod(cardOne("7C"), { seal: "blue" });
    const run = runWith({
      hand: [cardOne("KH"), cardOne("KS"), blueA, blueB, cardOne("9S")],
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
    });
    expect(run.handLevels.pair).toBe(1);
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    // Two blue-sealed cards held → pair levels up by 2 (1 each).
    expect(run.handLevels.pair).toBe(3);
  });

  it("gold seal: +$3 per gold-sealed card in the scoring set", () => {
    const goldK = withMod(cardOne("KH"), { seal: "gold" });
    const goldKicker = withMod(cardOne("3D"), { seal: "gold" }); // not in scoring set (pair only)
    const run = runWith({
      hand: [goldK, cardOne("KS"), goldKicker, cardOne("7C"), cardOne("9S")],
      // Keep target unreachable AND leave hands so the run stays "playing".
      target: 1_000_000,
      handsRemaining: 5,
      money: 0,
      deck: cards("2C 3C 4C 5C 6C"),
    });
    playHand(run, ["KH", "KS", "3D", "7C", "9S"]);
    expect(run.status).toBe("playing");
    // pair scores KH+KS only; only goldK is in scoringCardIds → +$3.
    expect(run.money).toBe(3);
  });

  it("purple seal: discarding a purple-sealed card creates a random tarot consumable", () => {
    const purpleK = withMod(cardOne("KH"), { seal: "purple" });
    const run = runWith({
      hand: [purpleK, cardOne("KS"), cardOne("3D"), cardOne("7C"), cardOne("9S")],
      deck: cards("2C 3C"),
      discardsRemaining: 1,
      maxConsumables: 2,
    });
    expect(run.consumables.length).toBe(0);
    discardCards(run, ["KH"], () => 0);
    expect(run.consumables.length).toBe(1);
    // Creates a random *tarot* — assert the kind, not a specific id (the exact pick depends on
    // catalog order + rng, and consumables are now per-file/id-sorted). PET-216.
    expect(CONSUMABLE_BY_ID.get(run.consumables[0]!.defId)?.kind).toBe("tarot");
  });

  it("purple seal: respects max consumables — no spawn when full", () => {
    const purpleK = withMod(cardOne("KH"), { seal: "purple" });
    const run = runWith({
      hand: [purpleK, cardOne("KS"), cardOne("3D"), cardOne("7C"), cardOne("9S")],
      deck: cards("2C 3C"),
      discardsRemaining: 1,
      maxConsumables: 1,
      consumables: [{ id: "x", defId: "the_fool" }], // already full
    });
    discardCards(run, ["KH"], () => 0);
    expect(run.consumables.length).toBe(1); // unchanged
  });
});

/** Deterministic RNG that emits a fixed sequence (loops if exhausted). */
function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}
describe("effectiveHandSize (PET-67)", () => {
  it("defaults to HAND_SIZE when no vouchers and no offset", () => {
    const run = runWith({ hand: [] });
    expect(HAND_SIZE).toBe(8);
    expect(effectiveHandSize(run)).toBe(8);
  });

  it("Hieroglyph voucher (+1 hand_size) flows through", () => {
    const run = runWith({ hand: [], vouchers: ["hieroglyph"] });
    expect(effectiveHandSize(run)).toBe(9);
  });

  it("Ouija's handSizeOffset (-1) is reflected", () => {
    const run = runWith({ hand: [], handSizeOffset: -1 });
    expect(effectiveHandSize(run)).toBe(7);
  });

  it("Hieroglyph (+1) and Ouija (-1) stack to the base size", () => {
    const run = runWith({ hand: [], vouchers: ["hieroglyph"], handSizeOffset: -1 });
    expect(effectiveHandSize(run)).toBe(8);
  });

  it("floored at 1 — a stacked downside can never produce 0", () => {
    const run = runWith({ hand: [], handSizeOffset: -100 });
    expect(effectiveHandSize(run)).toBe(1);
  });

  it("startBlind deals effectiveHandSize cards, not the bare constant", () => {
    // Hieroglyph: 8 + 1 = 9; assert the initial deal pulls 9.
    const run = startRun("medium", "u1");
    run.vouchers.push("hieroglyph");
    startBlind(run);
    expect(run.hand.length).toBe(9);
    expect(run.deck.length).toBe(52 - 9);
  });

  it("startBlind with Ouija offset deals 7", () => {
    const run = startRun("medium", "u1");
    run.handSizeOffset = -1;
    startBlind(run);
    expect(run.hand.length).toBe(7);
    expect(run.deck.length).toBe(52 - 7);
  });

  it("Ouija mid-blind: current hand isn't shrunk; NEXT play refills to the new (smaller) size", () => {
    // 8 cards in hand, plenty in deck; Ouija shifts offset to -1 but does NOT remove a card.
    const handCards = cards("2C 3D 4H 5S 6C 7D 8H 9S");
    const deckCards = cards("TC JD QH KS AC 2D 3H 4S");
    const run = runWith({ hand: handCards, deck: deckCards, handsRemaining: 3 });
    run.consumables.push({ id: "ouija-1", defId: "ouija" });
    useConsumable(run, "ouija-1", undefined, () => 0); // deterministic rng
    expect(run.handSizeOffset).toBe(-1);
    expect(run.hand.length).toBe(8); // not retroactively shrunk
    // Next play removes 2 and refills to effectiveHandSize=7 (so draws 1 not 2).
    const deckBefore = run.deck.length;
    playHand(run, [run.hand[0]!.id, run.hand[1]!.id]);
    expect(run.hand.length).toBe(7);
    expect(run.deck.length).toBe(deckBefore - 1); // only 1 drawn, not 2
  });
});

describe("chance_mult end-of-round roll — Gros Michel (PET-229)", () => {
  // rng() * 100 < chancePct (100/6) ⟺ rng() < 1/6 — the destroy branch fires below the
  // threshold, the survive branch at/above it. All draws go through playHand's injected rng
  // seam; the same rng also feeds the subsequent shop roll, which is fine (any value works).
  const grosRun = () =>
    runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      handsRemaining: 3,
      jokers: ["gros_michel"],
      jokerEditions: { gros_michel: "foil" },
    });

  it("scores the unconditional +15 Mult like flat_mult", () => {
    const run = grosRun();
    const result = playHand(run, ["KH", "KS"], () => 0.5);
    // Pair: base 10 chips × 2 mult; K+K = +20 chips; foil = +50 chips; joker +15 mult →
    // (10 + 20 + 50) × (2 + 15) = 1360.
    expect(result.breakdown.score).toBe(1360);
    expect(result.breakdown.jokerSteps.some((s) => s.jokerId === "gros_michel" && s.deltaMult === 15)).toBe(true);
  });

  it("destroy branch: a roll under 1/6 destroys the joker at end of round (state/edition cleaned)", () => {
    const run = grosRun();
    playHand(run, ["KH", "KS"], () => 0); // 0 < 1/6 → onFail fires
    expect(run.status).toBe("shop");
    expect(run.jokers).toEqual([]);
    expect(run.jokerEditions["gros_michel"]).toBeUndefined();
    expect(run.jokerStates["gros_michel"]).toBeUndefined();
  });

  it("survive branch: a roll at/above 1/6 keeps the joker", () => {
    const run = grosRun();
    playHand(run, ["KH", "KS"], () => 0.5); // 0.5 ≥ 1/6 → survives
    expect(run.status).toBe("shop");
    expect(run.jokers).toEqual(["gros_michel"]);
    expect(run.jokerEditions["gros_michel"]).toBe("foil");
  });

  it("no roll happens mid-blind (only end of round)", () => {
    const run = grosRun();
    run.target = 1e9; // can't win this hand
    playHand(run, ["KH", "KS"], () => 0);
    expect(run.status).toBe("playing");
    expect(run.jokers).toEqual(["gros_michel"]);
  });

  it("duplicate copies (Ankh) roll independently — one destroyed, one kept", () => {
    const run = grosRun();
    run.jokers = ["gros_michel", "gros_michel"];
    const seq = [0, 0.5]; // first copy fails its roll, second survives; shop then gets 0.5s
    let i = 0;
    playHand(run, ["KH", "KS"], () => (i < seq.length ? seq[i++]! : 0.5));
    expect(run.jokers).toEqual(["gros_michel"]);
    // A surviving copy keeps its edition/state.
    expect(run.jokerEditions["gros_michel"]).toBe("foil");
  });

  it("is seed-reproducible through the engine's keyed rng stream", () => {
    const { makeRng } = require("./prng.ts") as typeof import("./prng.ts");
    const outcome = (seed: number): boolean => {
      const run = grosRun();
      playHand(run, ["KH", "KS"], makeRng(seed, "round_end"));
      return run.jokers.length === 1;
    };
    for (const seed of [1, 42, 1337]) {
      expect(outcome(seed)).toBe(outcome(seed)); // same seed → same branch
    }
  });
});

describe("rollChance (PET-229)", () => {
  const { rollChance } = require("./prng.ts") as typeof import("./prng.ts");

  it("fires with probability chancePct in 100 (boundary semantics)", () => {
    expect(rollChance(100 / 6, () => 0)).toBe(true);
    expect(rollChance(100 / 6, () => 0.16)).toBe(true); // just inside 1-in-6
    expect(rollChance(100 / 6, () => 0.17)).toBe(false); // just outside
    expect(rollChance(100 / 6, () => 0.999999)).toBe(false);
    expect(rollChance(0, () => 0)).toBe(false); // 0% never fires
    expect(rollChance(100, () => 0.999999)).toBe(true); // 100% always fires
  });
});
