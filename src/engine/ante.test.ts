import { describe, expect, it } from "bun:test";
import { blindTarget, cashOutMoney, interestEarned } from "./ante.ts";

describe("blindTarget", () => {
  it("medium = authentic Balatro values (base × blind mult)", () => {
    expect(blindTarget(1, 0, "medium")).toBe(300); // 300 × 1
    expect(blindTarget(1, 1, "medium")).toBe(450); // 300 × 1.5
    expect(blindTarget(1, 2, "medium")).toBe(600); // 300 × 2
    expect(blindTarget(2, 0, "medium")).toBe(800);
    expect(blindTarget(8, 2, "medium")).toBe(100000); // 50000 × 2
  });

  it("applies the difficulty multiplier", () => {
    expect(blindTarget(1, 0, "easy")).toBe(180); // 300 × 0.6
    expect(blindTarget(1, 0, "hard")).toBe(420); // 300 × 1.4
  });
});

describe("interestEarned", () => {
  it("Balatro rule: $1 per $5 held, capped at $5", () => {
    expect(interestEarned(0)).toBe(0);
    expect(interestEarned(4)).toBe(0);
    expect(interestEarned(5)).toBe(1);
    expect(interestEarned(10)).toBe(2);
    expect(interestEarned(25)).toBe(5); // cap
    expect(interestEarned(100)).toBe(5); // cap
  });

  it("clamps negative balances to 0", () => {
    expect(interestEarned(-3)).toBe(0);
  });

  it("honors a custom cap (voucher hook)", () => {
    expect(interestEarned(100, 10)).toBe(10);
  });
});

describe("cashOutMoney", () => {
  it("breakdown = base + hands bonus + interest", () => {
    const b0 = cashOutMoney(0, 0, 0);
    expect(b0).toEqual({ blindBase: 3, handsBonus: 0, interest: 0 });

    const b1 = cashOutMoney(1, 2, 10);
    expect(b1).toEqual({ blindBase: 4, handsBonus: 2, interest: 2 }); // 4 + 2 + 2 = 8

    const b2 = cashOutMoney(2, 3, 25);
    expect(b2).toEqual({ blindBase: 5, handsBonus: 3, interest: 5 }); // boss + 3 + cap
  });

  it("interest scales $1 per $5 held, capped at $5", () => {
    expect(cashOutMoney(0, 0, 0).interest).toBe(0);
    expect(cashOutMoney(0, 0, 4).interest).toBe(0);
    expect(cashOutMoney(0, 0, 5).interest).toBe(1);
    expect(cashOutMoney(0, 0, 10).interest).toBe(2);
    expect(cashOutMoney(0, 0, 25).interest).toBe(5); // cap
    expect(cashOutMoney(0, 0, 100).interest).toBe(5); // cap
  });

  it("never subtracts for negative remaining hands", () => {
    expect(cashOutMoney(0, -5, 0).handsBonus).toBe(0);
  });

  it("defaults money to 0 (no interest) when omitted", () => {
    expect(cashOutMoney(0, 1).interest).toBe(0);
  });
});
