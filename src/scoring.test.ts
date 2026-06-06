import { describe, expect, it } from "bun:test";
import { scoreHand } from "./scoring.ts";
import { cards } from "./testkit.ts";

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
