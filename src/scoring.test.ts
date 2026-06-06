import { describe, expect, it } from "bun:test";
import { scoreHand } from "./scoring.ts";
import { card, cards, withMod } from "./testkit.ts";
import { evaluateHand } from "./evaluator.ts";

describe("scoreHand — authentic Balatro Level-1 totals", () => {
  it("pair of kings → 60", () => {
    const s = scoreHand(cards("KH KS 3D 7C 9S"));
    expect(s.handType).toBe("pair");
    expect(s.score).toBe(60); // (10 base + 10 + 10) * 2
  });

  it("flush → 284", () => {
    const s = scoreHand(cards("2H 5H 9H JH KH"));
    expect(s.score).toBe(284); // (35 + 2+5+9+10+10) * 4
  });

  it("royal flush → 1208", () => {
    const s = scoreHand(cards("TS JS QS KS AS"));
    expect(s.score).toBe(1208); // (100 + 10+10+10+10+11) * 8
  });

  it("four of a kind excludes kicker → 672", () => {
    const s = scoreHand(cards("9C 9D 9H 9S KC"));
    expect(s.score).toBe(672); // (60 + 9*4) * 7
  });

  it("two pair excludes kicker → 108", () => {
    const s = scoreHand(cards("KH KS 7C 7S 2D"));
    expect(s.score).toBe(108); // (20 + 10+10+7+7) * 2
  });

  it("single ace high card → 16", () => {
    const s = scoreHand(cards("AS"));
    expect(s.score).toBe(16); // (5 + 11) * 1
  });

  it("five of a kind (5 nines) → 1140", () => {
    const s = scoreHand(cards("9C 9D 9H 9S 9C2"));
    expect(s.handType).toBe("five_of_a_kind");
    expect(s.score).toBe(1140); // (50 + 9*5) * 12
  });

  it("flush house (KKK 77 all hearts) → 1176", () => {
    const s = scoreHand(cards("KH KH2 KH3 7H 7H2"));
    expect(s.handType).toBe("flush_house");
    expect(s.score).toBe(1176); // (40 + 10+10+10+7+7) * 14
  });

  it("flush five (5 nines of clubs) → 3280", () => {
    const s = scoreHand(cards("9C 9C2 9C3 9C4 9C5"));
    expect(s.handType).toBe("flush_five");
    expect(s.score).toBe(3280); // (160 + 9*5) * 16
  });
});

describe("scoreHand — card modifier scoring (PET-75)", () => {
  it("enhancement bonus adds +30 chips per scored card", () => {
    const hand = [withMod(card("KH"), { enhancement: "bonus" }), card("KS"), card("3D"), card("7C"), card("9S")];
    // pair: base 10c/2m + KH(10)+KS(10) cards + bonus(+30) = 60 chips × 2 mult = 120
    const s = scoreHand(hand);
    expect(s.handType).toBe("pair");
    expect(s.score).toBe(120);
  });

  it("enhancement mult adds +4 mult per scored card", () => {
    const hand = [withMod(card("KH"), { enhancement: "mult" }), card("KS"), card("3D"), card("7C"), card("9S")];
    // pair: (10 + 10 + 10) chips × (2 + 4) mult = 30 × 6 = 180
    const s = scoreHand(hand);
    expect(s.score).toBe(180);
  });

  it("edition foil adds +50 chips", () => {
    const hand = [withMod(card("KH"), { edition: "foil" }), card("KS"), card("3D"), card("7C"), card("9S")];
    // (10 + 10 + 10 + 50) × 2 = 160
    expect(scoreHand(hand).score).toBe(160);
  });

  it("edition holo adds +10 mult", () => {
    const hand = [withMod(card("KH"), { edition: "holo" }), card("KS"), card("3D"), card("7C"), card("9S")];
    // (10 + 20) × (2 + 10) = 30 × 12 = 360
    expect(scoreHand(hand).score).toBe(360);
  });

  it("edition poly multiplies mult by ×1.5", () => {
    const hand = [withMod(card("KH"), { edition: "poly" }), card("KS"), card("3D"), card("7C"), card("9S")];
    // (10 + 20) × (2 × 1.5) = 30 × 3 = 90
    expect(scoreHand(hand).score).toBe(90);
  });

  it("glass enhancement: each glass card scored is ×2 mult (compounding)", () => {
    const hand = [
      withMod(card("KH"), { enhancement: "glass" }),
      withMod(card("KS"), { enhancement: "glass" }),
      card("3D"), card("7C"), card("9S"),
    ];
    // (10 + 10 + 10) × (2 × 2 × 2) = 30 × 8 = 240
    expect(scoreHand(hand).score).toBe(240);
  });

  it("wild card lets a non-suited card complete a flush", () => {
    const hand = [
      withMod(card("2C"), { enhancement: "wild" }),
      card("5H"), card("9H"), card("JH"), card("KH"),
    ];
    const r = evaluateHand(hand);
    expect(r.handType).toBe("flush");
    // flush base 35/4 + chips 2+5+9+10+10 = 35+36 = 71 × 4 = 284
    expect(scoreHand(hand).score).toBe(284);
  });

  it("stone card: +50 chips, doesn't form a straight", () => {
    // A stone "AH" played alongside 2D 3H 4S 5C would otherwise be the ace of a wheel.
    // With stone the rank vanishes from straight detection → just high_card on 5C.
    const hand = [
      withMod(card("AH"), { enhancement: "stone" }),
      card("2D"), card("3H"), card("4S"), card("5C"),
    ];
    const r = evaluateHand(hand);
    expect(r.handType).toBe("high_card");
    // high_card scoring: highest non-stone is 5C (chip 5), stone is also in scoringCardIds (+50)
    expect(r.scoringCardIds).toContain("AH"); // stone always scores
    expect(r.scoringCardIds).toContain("5C");
    // (base 5 + 5C chips 5 + stone +50) × 1 = 60
    expect(scoreHand(hand).score).toBe(60);
  });

  it("red seal: retriggers chip contribution (doubles rank chips)", () => {
    const hand = [
      withMod(card("KH"), { seal: "red" }),
      card("KS"), card("3D"), card("7C"), card("9S"),
    ];
    // pair: (10 base + 10 + 10 cards + 10 red retrigger) × 2 mult = 40 × 2 = 80
    expect(scoreHand(hand).score).toBe(80);
  });
});
