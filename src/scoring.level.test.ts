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

  it("five of a kind level 2 (Planet X): +35 chips, +4 mult", () => {
    const levels = defaultHandLevels();
    levels.five_of_a_kind = 2;
    const s = scoreHand(cards("9C 9D 9H 9S 9C2"), { handLevels: levels });
    // chips 50+35 = 85; mult 12+4 = 16; cards 9*5 = 45 → (85+45)*16 = 2080
    expect(s.handType).toBe("five_of_a_kind");
    expect(s.handLevel).toBe(2);
    expect(s.score).toBe(2080);
  });

  it("flush house level 2 (Ceres): +40 chips, +4 mult", () => {
    const levels = defaultHandLevels();
    levels.flush_house = 2;
    const s = scoreHand(cards("KH KH2 KH3 7H 7H2"), { handLevels: levels });
    // chips 40+40 = 80; mult 14+4 = 18; cards 10+10+10+7+7 = 44 → (80+44)*18 = 2232
    expect(s.handType).toBe("flush_house");
    expect(s.handLevel).toBe(2);
    expect(s.score).toBe(2232);
  });

  it("flush five level 2 (Eris): +50 chips, +3 mult", () => {
    const levels = defaultHandLevels();
    levels.flush_five = 2;
    const s = scoreHand(cards("9C 9C2 9C3 9C4 9C5"), { handLevels: levels });
    // chips 160+50 = 210; mult 16+3 = 19; cards 9*5 = 45 → (210+45)*19 = 4845
    expect(s.handType).toBe("flush_five");
    expect(s.handLevel).toBe(2);
    expect(s.score).toBe(4845);
  });
});
