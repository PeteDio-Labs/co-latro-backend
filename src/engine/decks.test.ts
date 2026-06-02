import { describe, expect, it } from "bun:test";
import { DECKS, getDeck, listDecks } from "./decks.ts";
import { instantiateDeck, parseFace } from "../cards.ts";
import { GameError } from "./errors.ts";

describe("preset decks", () => {
  it("standard = 52 cards", () => {
    expect(getDeck("standard").composition.length).toBe(52);
  });

  it("abandoned = 40 cards, no J/Q/K, keeps aces", () => {
    const comp = getDeck("abandoned").composition;
    expect(comp.length).toBe(40);
    const ranks = comp.map((c) => parseFace(c).rank);
    expect(ranks.includes(11)).toBe(false);
    expect(ranks.includes(12)).toBe(false);
    expect(ranks.includes(13)).toBe(false);
    expect(ranks.includes(14)).toBe(true);
  });

  it("checkered = 52, only ♥/♠, duplicates instantiate to unique ids", () => {
    const comp = getDeck("checkered").composition;
    expect(comp.length).toBe(52);
    expect([...new Set(comp.map((c) => parseFace(c).suit))].sort()).toEqual(["hearts", "spades"]);
    const deck = instantiateDeck(comp.map(parseFace));
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it("perks present", () => {
    expect(getDeck("red").perk.extraDiscards).toBe(1);
    expect(getDeck("blue").perk.extraHands).toBe(1);
    expect(getDeck("yellow").perk.startMoney).toBe(10);
  });

  it("listDecks returns every preset with a size", () => {
    expect(listDecks().length).toBe(DECKS.length);
    expect(listDecks().find((d) => d.id === "checkered")?.size).toBe(52);
  });

  it("getDeck throws on unknown id", () => {
    expect(() => getDeck("nope")).toThrow(GameError);
  });
});
