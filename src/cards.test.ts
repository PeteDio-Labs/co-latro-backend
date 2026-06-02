import { describe, expect, it } from "bun:test";
import { faceCode, instantiateDeck, parseFace, standardFaces } from "./cards.ts";

describe("faces + instantiateDeck", () => {
  it("faceCode / parseFace round-trip for all 52", () => {
    for (const f of standardFaces()) {
      expect(parseFace(faceCode(f))).toEqual(f);
    }
  });

  it("parseFace throws on bad input", () => {
    expect(() => parseFace("ZZ")).toThrow();
    expect(() => parseFace("")).toThrow();
  });

  it("standardFaces has 52 distinct faces", () => {
    const faces = standardFaces();
    expect(faces.length).toBe(52);
    expect(new Set(faces.map(faceCode)).size).toBe(52);
  });

  it("instantiateDeck gives unique ids, even for duplicate faces", () => {
    const deck = instantiateDeck([parseFace("KH"), parseFace("KH"), parseFace("AS")]);
    expect(deck.map((c) => c.id)).toEqual(["KH-0", "KH-1", "AS-0"]);
    expect(deck[0]!.rank).toBe(13);
    expect(deck[0]!.suit).toBe("hearts");
  });

  it("instantiateDeck(standardFaces()) → 52 unique ids", () => {
    const deck = instantiateDeck(standardFaces());
    expect(deck.length).toBe(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });
});
