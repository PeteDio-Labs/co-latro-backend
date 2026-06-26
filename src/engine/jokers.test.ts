import { describe, expect, it } from "bun:test";
import { JOKERS, getJoker, listJokers, sellValue } from "./jokers.ts";
import { GameError } from "./errors.ts";

describe("joker catalog", () => {
  it("listJokers returns the full catalog with unique ids", () => {
    const list = listJokers();
    expect(list.length).toBe(JOKERS.length);
    expect(new Set(list.map((j) => j.id)).size).toBe(list.length);
  });

  it("getJoker returns a def and throws on unknown", () => {
    expect(getJoker("joker").effect).toEqual({ kind: "flat_mult", mult: 4 });
    expect(() => getJoker("nope")).toThrow(GameError);
  });

  it("getJoker returns Twisted Joker effect", () => {
    expect(getJoker("twisted_joker").effect).toEqual({ kind: "flat_mult", mult: 5 });
  });

  it("sellValue = floor(cost/2), min 1", () => {
    expect(sellValue(3)).toBe(1);
    expect(sellValue(5)).toBe(2);
    expect(sellValue(8)).toBe(4);
    expect(sellValue(2)).toBe(1);
  });
});
