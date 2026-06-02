import { describe, expect, it } from "bun:test";
import { blindTarget, cashOutMoney } from "./ante.ts";

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

describe("cashOutMoney", () => {
  it("base reward + $1 per remaining hand", () => {
    expect(cashOutMoney(0, 0)).toBe(3); // small base
    expect(cashOutMoney(1, 2)).toBe(6); // big 4 + 2
    expect(cashOutMoney(2, 3)).toBe(8); // boss 5 + 3
  });

  it("never subtracts for negative remaining hands", () => {
    expect(cashOutMoney(0, -5)).toBe(3);
  });
});
