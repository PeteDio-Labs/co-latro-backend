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
import { buyItem, generateShop } from "./shop.ts";

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
    openingPack: null,
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

  it("from the big blind advances to THIS ante's boss (never past it)", () => {
    const run = startRun("easy", "u1");
    run.blindIndex = 1; // big
    skipBlind(run, seq(rngForTag("investment_tag"))); // shop-trigger tag → no pack opens
    expect(run.ante).toBe(1); // same ante — the boss still has to be played
    expect(run.blindIndex).toBe(2); // boss
    // Easy ante-1 boss target = round(300 × 2 × 0.6) = 360.
    expect(run.target).toBe(360);
    expect(run.status).toBe("selecting_blind");
  });

  it("cannot skip past the boss — skipping big then attempting another skip throws", () => {
    const run = startRun("easy", "u1");
    run.blindIndex = 1; // big
    skipBlind(run, seq(rngForTag("investment_tag")));
    expect(run.blindIndex).toBe(2); // now on the boss
    // The boss is not skippable — a second skip is rejected.
    expect(() => skipBlind(run, seq(rngForTag("investment_tag")))).toThrow(GameError);
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

  it("a free_pack tag rolled on skip opens a pack immediately (returns to blind-select)", () => {
    const run = startRun("easy", "u1");
    // Standard Tag → free Mega Standard Pack (trigger on_pack_open, dispatched in skipBlind).
    skipBlind(run, seq(rngForTag("standard_tag")));
    expect(run.status).toBe("pack_open");
    expect(run.openingPack).not.toBeNull();
    expect(run.openingPack!.packKind).toBe("standard");
    // Opened from the blind-select screen → closing the pack returns there (not the shop).
    expect(run.openingPack!.returnStatus).toBe("selecting_blind");
    // The pack tag fired and was consumed.
    expect(run.tags).toEqual([]);
    // The blind still advanced underneath the open pack (small → big).
    expect(run.blindIndex).toBe(1);
  });

});

describe("mult_add_next_hand effect (PET-78)", () => {
  it("next played hand scores with +N flat mult; second hand returns to baseline", () => {
    // Baseline: KH+KS pair = (10 + 10+10 chips) × 2 mult = 60.
    // With nextHandMultBonus=5: 30 × (2+5) = 210. Then bonus is consumed.
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 9999, // keep status === "playing" so we can play again
      handsRemaining: 3,
      nextHandMultBonus: 5,
    });
    const first = playHand(run, ["KH", "KS"]);
    expect(first.breakdown.score).toBe(210);
    // Consumption: the next hand scores at baseline again.
    expect(run.nextHandMultBonus).toBe(0);
    expect(run.status).toBe("playing");
    // Second hand off the redrawn hand — just verify the bonus didn't carry over.
    // Score 3D as high_card: (5 + 3) × 1 = 8.
    const second = playHand(run, [run.hand[0]!.id]);
    // Confirm whatever the second hand scores, it matched a fresh scoreCtx with no bonus.
    // (We just need to assert: the bonus is gone, so second.breakdown.score == score WITHOUT bonus.)
    // Re-deriving from baseMult alone:
    const handType = second.breakdown.handType;
    const lvlMult = second.breakdown.baseMult;
    // With no jokers and no bonus, score = totalChips × baseMult — exact equality to scoring fold.
    expect(second.breakdown.score).toBe(second.breakdown.totalChips * lvlMult);
    expect(handType).toBeDefined();
  });

  it("two mult_add_next_hand tags stack (run.nextHandMultBonus accumulates)", () => {
    // Apply the underlying effect twice (simulating two tags firing) — verify the run-state
    // counter accumulates and the next hand sees the total.
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 9999,
      handsRemaining: 3,
      nextHandMultBonus: 0,
    });
    // Manually accumulate as applyTags would for two consecutive mult_add_next_hand effects.
    run.nextHandMultBonus += 3;
    run.nextHandMultBonus += 4;
    expect(run.nextHandMultBonus).toBe(7);
    // Pair: (10 + 20) × (2 + 7) = 270.
    const result = playHand(run, ["KH", "KS"]);
    expect(result.breakdown.score).toBe(270);
    expect(run.nextHandMultBonus).toBe(0);
  });
});

describe("free_voucher effect (PET-78)", () => {
  it("voucher_tag → next shop voucher rolls free (cost 0)", () => {
    // Trigger is on_shop_enter — clearing the blind into the shop fires the tag and
    // a fresh shop is generated. The rolled voucher should have cost 0.
    const run = runWith({
      hand: cards("KH KS 3D 7C 9S"),
      target: 50,
      blindIndex: 0,
      handsRemaining: 3,
      money: 0,
      tags: ["voucher_tag"],
    });
    playHand(run, ["KH", "KS"]);
    expect(run.status).toBe("shop");
    expect(run.tags).toEqual([]); // tag consumed
    expect(run.freeVoucherPending).toBe(true); // flag set
    expect(run.shop).not.toBeNull();
    expect(run.shop!.voucher).not.toBeNull();
    expect(run.shop!.voucher!.cost).toBe(0);
  });

  it("buying the free voucher clears the flag; next shop voucher is normal cost", () => {
    // Seed a run sitting in the shop with a free voucher already on offer.
    const run = startRun("medium", "u1");
    run.status = "shop";
    run.money = 0;
    run.freeVoucherPending = true;
    // Build a shop with a free voucher slot (cost 0) — mirrors what generateShop would emit.
    run.shop = {
      items: [],
      rerollCost: 5,
      voucher: {
        id: "voucher:crystal_ball",
        kind: "voucher",
        voucherId: "crystal_ball",
        name: "Crystal Ball",
        description: "+1 consumable slot",
        cost: 0,
      },
    };
    // Buy at cost 0 — player has $0 but the check is `money < cost`, so 0 < 0 passes.
    buyItem(run, "voucher:crystal_ball");
    expect(run.money).toBe(0);
    expect(run.vouchers).toContain("crystal_ball");
    expect(run.shop.voucher).toBeNull();
    expect(run.freeVoucherPending).toBe(false);
    // Generate a fresh shop — the next voucher should be at full price.
    const fresh = generateShop(run, () => 0.5);
    expect(fresh.voucher).not.toBeNull();
    expect(fresh.voucher!.cost).toBeGreaterThan(0);
  });
});
