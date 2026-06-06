import { describe, expect, it } from "bun:test";
import { evaluateHand } from "./evaluator.ts";
import { card, cards } from "./testkit.ts";

describe("evaluateHand — hand types", () => {
  it("ace-low straight (wheel)", () => {
    const r = evaluateHand(cards("AC 2D 3H 4S 5C"));
    expect(r.handType).toBe("straight");
    expect(r.scoringCardIds.length).toBe(5);
  });

  it("ace-high straight", () => {
    expect(evaluateHand(cards("TC JD QH KS AC")).handType).toBe("straight");
  });

  it("royal flush", () => {
    const r = evaluateHand(cards("TS JS QS KS AS"));
    expect(r.handType).toBe("royal_flush");
    expect(r.scoringCardIds.length).toBe(5);
  });

  it("straight flush (non-royal)", () => {
    expect(evaluateHand(cards("5H 6H 7H 8H 9H")).handType).toBe("straight_flush");
  });

  it("wheel straight flush is straight_flush, not royal", () => {
    expect(evaluateHand(cards("AH 2H 3H 4H 5H")).handType).toBe("straight_flush");
  });

  it("flush that is not a straight", () => {
    expect(evaluateHand(cards("2H 5H 9H JH KH")).handType).toBe("flush");
  });

  it("straight that is not a flush", () => {
    expect(evaluateHand(cards("5H 6D 7H 8S 9C")).handType).toBe("straight");
  });

  it("A-K-Q-J-2 is NOT a straight (gap) → high card", () => {
    const r = evaluateHand(cards("AC KD QH JS 2C"));
    expect(r.handType).toBe("high_card");
    expect(r.scoringCardIds).toEqual(["AC"]);
  });

  it("full house", () => {
    expect(evaluateHand(cards("KH KS KD 7C 7S")).handType).toBe("full_house");
  });

  it("three of a kind (3+1+1) scores only the trips", () => {
    const r = evaluateHand(cards("KH KS KD 7C 2S"));
    expect(r.handType).toBe("three_of_a_kind");
    expect(new Set(r.scoringCardIds)).toEqual(new Set(["KH", "KS", "KD"]));
  });

  it("two pair scores all four matched cards", () => {
    const r = evaluateHand(cards("KH KS 7C 7S 2D"));
    expect(r.handType).toBe("two_pair");
    expect(new Set(r.scoringCardIds)).toEqual(new Set(["KH", "KS", "7C", "7S"]));
  });

  it("four of a kind excludes the kicker", () => {
    const r = evaluateHand(cards("9C 9D 9H 9S KC"));
    expect(r.handType).toBe("four_of_a_kind");
    expect(new Set(r.scoringCardIds)).toEqual(new Set(["9C", "9D", "9H", "9S"]));
  });

  it("pair scores exactly the two matched cards", () => {
    const r = evaluateHand(cards("KH KS 3D 7C 9S"));
    expect(r.handType).toBe("pair");
    expect(new Set(r.scoringCardIds)).toEqual(new Set(["KH", "KS"]));
  });

  it("high card scores the single highest card", () => {
    const r = evaluateHand(cards("2C 5D 9H JS KC"));
    expect(r.handType).toBe("high_card");
    expect(r.scoringCardIds).toEqual(["KC"]);
  });

  it("preserves input order in scoringCardIds", () => {
    const r = evaluateHand(cards("7C KH 7S KS 2D"));
    expect(r.handType).toBe("two_pair");
    expect(r.scoringCardIds).toEqual(["7C", "KH", "7S", "KS"]);
  });
});

describe("evaluateHand — secret hands (Balatro)", () => {
  // The card ids carry suits, so the same rank in different "duplicates" gets distinct ids.
  // These shapes require Wilds in real play (PET-75); the evaluator still detects them.
  it("five of a kind (5 same rank, mixed suits)", () => {
    const r = evaluateHand(cards("9C 9D 9H 9S 9C2"));
    expect(r.handType).toBe("five_of_a_kind");
    expect(r.scoringCardIds.length).toBe(5);
  });

  it("flush house (full house, all one suit)", () => {
    const r = evaluateHand(cards("KH KH2 KH3 7H 7H2"));
    expect(r.handType).toBe("flush_house");
    expect(r.scoringCardIds.length).toBe(5);
  });

  it("flush five (5 same rank, same suit)", () => {
    const r = evaluateHand(cards("9C 9C2 9C3 9C4 9C5"));
    expect(r.handType).toBe("flush_five");
    expect(r.scoringCardIds.length).toBe(5);
  });

  it("five of a kind ranks above four of a kind", () => {
    // Without the new check, 5 nines would fall to four_of_a_kind.
    expect(evaluateHand(cards("9C 9D 9H 9S 9C2")).handType).toBe("five_of_a_kind");
  });

  it("flush house ranks above full house and flush", () => {
    expect(evaluateHand(cards("KH KH2 KH3 7H 7H2")).handType).toBe("flush_house");
  });

  it("flush five ranks above flush house and five of a kind", () => {
    expect(evaluateHand(cards("9C 9C2 9C3 9C4 9C5")).handType).toBe("flush_five");
  });
});

describe("evaluateHand — fewer than 5 cards", () => {
  it("1-card play is high card", () => {
    const r = evaluateHand([card("AS")]);
    expect(r.handType).toBe("high_card");
    expect(r.scoringCardIds).toEqual(["AS"]);
  });

  it("2 cards → pair", () => expect(evaluateHand(cards("KH KS")).handType).toBe("pair"));
  it("3 cards → trips", () => expect(evaluateHand(cards("KH KS KD")).handType).toBe("three_of_a_kind"));
  it("4 cards → two pair", () => expect(evaluateHand(cards("KH KS QC QD")).handType).toBe("two_pair"));

  it("4-card same-suit run is NOT a flush or straight", () => {
    expect(evaluateHand(cards("2H 3H 4H 5H")).handType).toBe("high_card");
  });
});

describe("evaluateHand — guards", () => {
  it("throws on empty selection", () => expect(() => evaluateHand([])).toThrow());
  it("throws on more than 5 cards", () =>
    expect(() => evaluateHand(cards("2H 3H 4H 5H 6H 7H"))).toThrow());
});
