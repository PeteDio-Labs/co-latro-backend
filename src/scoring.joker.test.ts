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

  it("per_suit_mult (Icy Joker): flush of 5 clubs, +4 Mult each", () => {
    // (35 + 2+5+9+10+10) × (4 + 5×4) = 71 × 24 = 1704
    expect(scoreHand(cards("2C 5C 9C JC KC"), ctx(["icy_joker"])).score).toBe(1704);
  });

  it("per_suit_chips (Arrowhead): flush of 5 spades, +50 Chips each", () => {
    // (35 + 2+5+9+10+10 + 5×50) × 4 = (71 + 250) × 4 = 1284
    expect(scoreHand(cards("2S 5S 9S JS KS"), ctx(["arrowhead"])).score).toBe(1284);
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

describe("PET-74 expansion effects", () => {
  it("retrigger_face (Vagabond): face card chips score twice; non-face untouched", () => {
    // KH KS 3D 7C 9S → pair of K's scored. K chip value = 10 each. Base pair: 10/2.
    // Without retrigger: (10 + 10+10) × 2 = 60. With one retrigger: face chips × 2 → (10 + 20+20) × 2 = 100.
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["vagabond"])).score).toBe(100);
    // No face cards scored → retrigger is a no-op.
    expect(scoreHand(cards("8H 8S 3D 7C 9S"), ctx(["vagabond"])).score).toBe(52); // (10 + 8+8) × 2
  });

  it("retrigger_face stacks: two retrigger jokers triple face chip contribution", () => {
    // (10 + 10×3 + 10×3) × 2 = 140.
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["vagabond", "hanging_chad"])).score).toBe(140);
  });

  it("scaling_per_blind_mult (Green Joker): mult scales by counter", () => {
    // counter=0 → +0 mult
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["green_joker"], { jokerStates: { green_joker: { counter: 0 } } })).score).toBe(60);
    // counter=5, +1 each → +5 mult: (10+20) × (2+5) = 210
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["green_joker"], { jokerStates: { green_joker: { counter: 5 } } })).score).toBe(210);
  });

  it("scaling_per_blind_chips (Square Joker): chips scale by counter", () => {
    // counter=4, +4 each → +16 chips: (10+20+16) × 2 = 92
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["square_joker"], { jokerStates: { square_joker: { counter: 4 } } })).score).toBe(92);
  });

  it("on_discard_chips (Frugal): +chips × discardsUsedThisBlind", () => {
    // 2 discards used, +50 each → +100 chips: (10+20+100) × 2 = 260
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["frugal_joker"], { discardsUsedThisBlind: 2 })).score).toBe(260);
    // 0 discards used → no contribution.
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["frugal_joker"], { discardsUsedThisBlind: 0 })).score).toBe(60);
  });

  it("flat_chips_and_mult (Walkie Talkie): adds both chips and mult in one step", () => {
    // (10+20+10) × (2+4) = 240
    const result = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["walkie_talkie"]));
    expect(result.score).toBe(240);
    expect(result.jokerSteps).toEqual([
      { jokerId: "walkie_talkie", name: "Walkie Talkie", deltaChips: 10, deltaMult: 4 },
    ]);
  });

  it("per_5_dollars_mult (Bull): +mult × floor(money / 5)", () => {
    // $12 → floor(12/5)=2, +2 each → +4 mult: 30 × (2+4) = 180
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["bull"], { money: 12 })).score).toBe(180);
    // $4 → 0 contribution.
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["bull"], { money: 4 })).score).toBe(60);
  });

  it("economy_per_hand_played has no chip/mult contribution during scoring", () => {
    // Cloud 9 only pays out money in run.ts — scoring output is the no-joker baseline.
    expect(scoreHand(cards("KH KS 3D 7C 9S"), ctx(["cloud_9"])).score).toBe(60);
  });

  it("retrigger_face logs an animation step only when faces were scored", () => {
    const withFace = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["vagabond"]));
    expect(withFace.jokerSteps).toEqual([{ jokerId: "vagabond", name: "Vagabond" }]);
    const noFace = scoreHand(cards("8H 8S 3D 7C 9S"), ctx(["vagabond"]));
    expect(noFace.jokerSteps).toHaveLength(0);
  });
});

describe("PET-67 joker editions", () => {
  // baseline pair: (10 + 10+10) × 2 = 60
  it("foil adds +50 chips after the joker contribution", () => {
    // Joker: (30) × (2+4) = 180 baseline. Foil adds +50 chips first → (30+50) × 6 = 480.
    const r = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker"], { jokerEditions: { joker: "foil" } }));
    expect(r.score).toBe(480);
    // Edition step is animated alongside the joker step.
    expect(r.jokerSteps).toEqual([
      { jokerId: "joker", name: "Joker", deltaMult: 4 },
      { jokerId: "joker", name: "Joker [foil]", deltaChips: 50 },
    ]);
  });

  it("holo adds +10 mult after the joker contribution", () => {
    // Joker: +4 mult; +10 holo. (30) × (2+4+10) = 480.
    expect(
      scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker"], { jokerEditions: { joker: "holo" } })).score,
    ).toBe(480);
  });

  it("poly multiplies the running mult by 1.5", () => {
    // Joker: +4 mult, then ×1.5 → 9. 30 × 9 = 270.
    expect(
      scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker"], { jokerEditions: { joker: "poly" } })).score,
    ).toBe(270);
  });

  it("negative is slot-only — no scoring effect on the joker fold", () => {
    // Joker alone: (30) × (2+4) = 180.
    expect(
      scoreHand(cards("KH KS 3D 7C 9S"), ctx(["joker"], { jokerEditions: { joker: "negative" } })).score,
    ).toBe(180);
  });
});

describe("PET-231 held-in-hand effects", () => {
  it("held_rank_x_mult (Baron): ×1.5 Mult per King HELD (not played)", () => {
    // Play "9S" alone; one King ("KH") sits unplayed in hand alongside it.
    // High card 9: (5+9) × 1 = 14 baseline. Baron: one King held → ×1.5 → round(14×1.5) = 21.
    const r = scoreHand(cards("9S"), ctx(["baron"], { handHeld: cards("KH 9S") }));
    expect(r.score).toBe(21);
    expect(r.jokerSteps).toEqual([{ jokerId: "baron", name: "Baron", xMult: 1.5 }]);
  });

  it("held_rank_x_mult compounds per held King: two Kings held → ×1.5²", () => {
    // (5+9) × 1.5² = 14 × 2.25 = 31.5 → round 32.
    const r = scoreHand(cards("9S"), ctx(["baron"], { handHeld: cards("KH KS 9S") }));
    expect(r.score).toBe(32);
  });

  it("a King that is PLAYED does not count towards Baron's held bonus", () => {
    // Both Kings are played (and thus scored as a pair), so held-King count is 0 → no bonus.
    // Pair of Kings: (10 + 10+10) × 2 = 60.
    const r = scoreHand(cards("KH KS 3D 7C 9S"), ctx(["baron"], { handHeld: cards("KH KS 3D 7C 9S") }));
    expect(r.score).toBe(60);
    expect(r.jokerSteps).toHaveLength(0);
  });

  it("no Kings held is a no-op", () => {
    const r = scoreHand(cards("9S"), ctx(["baron"], { handHeld: cards("7C 9S") }));
    expect(r.score).toBe(14); // (5+9) × 1
    expect(r.jokerSteps).toHaveLength(0);
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
