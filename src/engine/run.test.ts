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
  type RunState,
} from "./run.ts";
import { cards } from "../testkit.ts";
import { faceCode, standardFaces } from "../cards.ts";
import { defaultHandLevels } from "../scoring.ts";

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
    openingPack: null,
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
});
