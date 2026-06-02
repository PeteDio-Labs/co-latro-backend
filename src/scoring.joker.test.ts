import { describe, expect, it } from "bun:test";
import { defaultHandLevels, handFeatures, scoreHand, type ScoreContext } from "./scoring.ts";
import { cards } from "./testkit.ts";

function ctx(jokers: string[], extra: Partial<ScoreContext> = {}): ScoreContext {
  return { handLevels: defaultHandLevels(), jokers, ...extra };
}

describe("joker effects", () => {
  it("flat_mult (Joker): pair 60 → 180 with +4 Mult", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker"])).score).toBe(180); // (10+20) × (2+4)
  });

  it("per_suit_mult (Lusty): flush of 5 hearts, +3 Mult each", () => {
    // (35 + 2+5+9+10+10) × (4 + 5×3) = 71 × 19 = 1349
    expect(scoreHand(cards("2H 5H 9H JH KH"), ctx(["lusty_joker"])).score).toBe(1349);
  });

  it("contains_mult (Jolly): +8 Mult on a pair", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["jolly_joker"])).score).toBe(300); // 30 × (2+8)
  });

  it("contains_chips (Sly): +50 Chips on a pair", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["sly_joker"])).score).toBe(160); // (30+50) × 2
  });

  it("hand_size_mult (Half): +20 Mult when ≤3 cards played", () => {
    expect(scoreHand(cards("KH KS"), ctx(["half_joker"])).score).toBe(660); // (10+20) × (2+20)
  });

  it("per_face_chips (Scary Face): +30 per scored face", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["scary_face"])).score).toBe(180); // (30+60) × 2
  });

  it("per_parity_mult (Even Steven): +4 Mult per even scored", () => {
    expect(scoreHand(cards("8H 8S 3D 7C 9S"), ctx(["even_steven"])).score).toBe(260); // (10+16) × (2+8)
  });

  it("per_parity_chips (Odd Todd): +31 Chips per odd scored", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["odd_todd"])).score).toBe(184); // (30+62) × 2
  });

  it("per_joker_mult (Abstract): +3 Mult per owned joker", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["abstract_joker"])).score).toBe(150); // 30 × (2+3)
  });

  it("per_remaining_discard_chips (Banner): +30 per remaining discard", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["banner"], { discardsRemaining: 3 })).score).toBe(240); // (30+90) × 2
  });

  it("x_mult_contains (The Duo): ×2 on a pair, no-op on high card", () => {
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["the_duo"])).score).toBe(120); // 30 × (2×2)
    expect(scoreHand(cards("2C 5D 9H JS KC"), ctx(["the_duo"])).score).toBe(15); // high card, no pair
  });

  it("ORDER MATTERS: ×Mult before vs after +Mult", () => {
    const before = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["the_duo", "joker"])).score; // (2×2)+4 = 8 → 240
    const after = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker", "the_duo"])).score; // (2+4)×2 = 12 → 360
    expect(before).toBe(240);
    expect(after).toBe(360);
  });

  it("jokerSteps records only fired jokers, in order", () => {
    const fired = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker", "sly_joker"])).jokerSteps;
    expect(fired.map((s) => s.jokerId)).toEqual(["joker", "sly_joker"]);
    const none = scoreHand(cards("2C 5D 9H JS KC"), ctx(["jolly_joker"])).jokerSteps; // no pair
    expect(none).toHaveLength(0);
  });
});

describe("handFeatures (contains semantics)", () => {
  it("full house contains pair + two_pair + three_of_a_kind", () => {
    expect(handFeatures(cards("KH KS KD 7C 7S"))).toEqual({
      pair: true,
      two_pair: true,
      three_of_a_kind: true,
      straight: false,
      flush: false,
    });
  });

  it("four of a kind contains pair + three_of_a_kind, not two_pair", () => {
    const f = handFeatures(cards("9C 9D 9H 9S KC"));
    expect(f.pair).toBe(true);
    expect(f.three_of_a_kind).toBe(true);
    expect(f.two_pair).toBe(false);
  });

  it("straight (incl. wheel) and flush detected; high card has none", () => {
    expect(handFeatures(cards("5H 6D 7H 8S 9C")).straight).toBe(true);
    expect(handFeatures(cards("AC 2D 3H 4S 5C")).straight).toBe(true);
    expect(handFeatures(cards("2H 5H 9H JH KH")).flush).toBe(true);
    expect(handFeatures(cards("2H 5H 9H JH KH")).straight).toBe(false);
    expect(handFeatures(cards("2C 5D 9H JS KC"))).toEqual({
      pair: false,
      two_pair: false,
      three_of_a_kind: false,
      straight: false,
      flush: false,
    });
  });
});
