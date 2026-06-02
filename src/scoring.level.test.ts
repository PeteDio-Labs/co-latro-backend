import { describe, expect, it } from "bun:test";
import { defaultHandLevels, scoreHand } from "./scoring.ts";
import { cards } from "./testkit.ts";

describe("leveled scoring", () => {
  it("level 1 (no ctx) matches base values", () => {
    const s = scoreHand(cards("KH KS 3D 7C 9S")); // pair
    expect(s.handLevel).toBe(1);
    expect(s.score).toBe(60);
  });

  it("pair level 2 (Mercury): +15 chips, +1 mult", () => {
    const levels = defaultHandLevels();
    levels.pair = 2;
    const s = scoreHand(cards("KH KS 3D 7C 9S"), { handLevels: levels });
    // (10+15 base + 10+10 cards) × (2+1) = 45 × 3 = 135
    expect(s.handLevel).toBe(2);
    expect(s.score).toBe(135);
  });

  it("straight level 3 (Saturn)", () => {
    const levels = defaultHandLevels();
    levels.straight = 3;
    const s = scoreHand(cards("5H 6D 7H 8S 9C"), { handLevels: levels });
    // chips 30 + 2×30 = 90; mult 4 + 2×3 = 10; cards 5+6+7+8+9 = 35 → (90+35)×10 = 1250
    expect(s.score).toBe(1250);
  });

  it("royal flush at the shared Neptune level scores like a leveled straight flush", () => {
    const levels = defaultHandLevels();
    levels.straight_flush = 4;
    levels.royal_flush = 4;
    const s = scoreHand(cards("TS JS QS KS AS"), { handLevels: levels });
    // chips 100 + 3×40 = 220; mult 8 + 3×4 = 20; cards 10+10+10+10+11 = 51 → (220+51)×20 = 5420
    expect(s.handLevel).toBe(4);
    expect(s.score).toBe(5420);
  });
});
