/**
 * Poker hand evaluator. PURE — no game state, no RNG, no mutation.
 *
 * Given 1-5 played cards it returns the best standard poker hand type AND the
 * exact set of "scoring" card ids (the cards that contribute chips in Balatro).
 * Kickers never score: a Pair inside a 5-card play scores only the 2 matched cards.
 */

import type { Card, Rank } from "./cards.ts";

export type HandType =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush"
  | "five_of_a_kind"
  | "flush_house"
  | "flush_five";

export interface EvaluatedHand {
  handType: HandType;
  /** Ids of the cards that FORM the hand (the chip-scoring cards), in input order. */
  scoringCardIds: string[];
}

function groupBy<K>(cards: Card[], keyOf: (c: Card) => K): Map<K, Card[]> {
  const map = new Map<K, Card[]>();
  for (const card of cards) {
    const arr = map.get(keyOf(card));
    if (arr) arr.push(card);
    else map.set(keyOf(card), [card]);
  }
  return map;
}

/** Flatten the rank-groups whose size equals `count` (e.g. the pair, the trips). */
function cardsWithCount(byRank: Map<Rank, Card[]>, count: number): Card[] {
  const out: Card[] = [];
  for (const group of byRank.values()) {
    if (group.length === count) out.push(...group);
  }
  return out;
}

function highestCard(cards: Card[]): Card {
  return cards.reduce((best, c) => (c.rank > best.rank ? c : best), cards[0]!);
}

export function evaluateHand(played: Card[]): EvaluatedHand {
  const n = played.length;
  if (n < 1 || n > 5) {
    throw new RangeError(`evaluateHand expects 1-5 cards, got ${n}`);
  }

  // PET-75: stone cards are rank/suit-less for shape detection (still score chips though).
  // Wild cards count as ANY suit for flush detection; their rank still counts normally.
  const nonStone = played.filter((c) => c.enhancement !== "stone");
  const nonStoneNonWild = nonStone.filter((c) => c.enhancement !== "wild");

  const byRank = groupBy(nonStone, (c) => c.rank);
  const bySuit = groupBy(nonStoneNonWild, (c) => c.suit);

  // Rank-count signature, descending: e.g. [4,1], [3,2], [2,2,1], [2,1,1,1], [1,...].
  const counts = [...byRank.values()].map((g) => g.length).sort((a, b) => b - a);
  const top = counts[0] ?? 0;
  const second = counts[1] ?? 0;

  // Flush requires exactly 5 cards of one suit. Wilds count as any suit, so if all
  // non-wild non-stone cards share a suit AND we still have 5 total cards played, it's a flush.
  // Stone cards never contribute to the flush.
  const allOneSuit = bySuit.size <= 1; // (size 0 = all wild, treated as a flush)
  const isFlush = n === 5 && nonStone.length === 5 && allOneSuit;

  const ranksAsc = nonStone.map((c) => c.rank).sort((a, b) => a - b);
  let isStraight = false;
  if (n === 5 && nonStone.length === 5 && byRank.size === 5) {
    const min = ranksAsc[0]!;
    const max = ranksAsc[4]!;
    // Ace-low wheel A-2-3-4-5 sorts ascending to [2,3,4,5,14].
    const isWheel =
      ranksAsc[0] === 2 &&
      ranksAsc[1] === 3 &&
      ranksAsc[2] === 4 &&
      ranksAsc[3] === 5 &&
      ranksAsc[4] === 14;
    // 5 distinct ranks spanning exactly 4 are necessarily consecutive (ace-high path).
    isStraight = max - min === 4 || isWheel;
  }

  const isStraightFlush = isStraight && isFlush;
  // Royal = ace-high straight flush; ascending min rank is 10 (10-J-Q-K-A).
  const isRoyal = isStraightFlush && ranksAsc[0] === 10;

  // Balatro secret hands. Possible once wild/enhanced cards land (PET-75); the
  // evaluator still recognises them whenever a 5-card play actually meets the shape.
  const isFiveOfAKind = n === 5 && top === 5;
  const isFlushFive = isFiveOfAKind && isFlush;
  const isFlushHouse = n === 5 && top === 3 && second === 2 && isFlush;

  let handType: HandType;
  let scoring: Card[];

  if (isFlushFive) {
    handType = "flush_five";
    scoring = played;
  } else if (isFlushHouse) {
    handType = "flush_house";
    scoring = played;
  } else if (isFiveOfAKind) {
    handType = "five_of_a_kind";
    scoring = played;
  } else if (isRoyal) {
    handType = "royal_flush";
    scoring = played;
  } else if (isStraightFlush) {
    handType = "straight_flush";
    scoring = played;
  } else if (top === 4) {
    handType = "four_of_a_kind";
    scoring = cardsWithCount(byRank, 4);
  } else if (top === 3 && second === 2) {
    handType = "full_house";
    scoring = played;
  } else if (isFlush) {
    handType = "flush";
    scoring = played;
  } else if (isStraight) {
    handType = "straight";
    scoring = played;
  } else if (top === 3) {
    handType = "three_of_a_kind";
    scoring = cardsWithCount(byRank, 3);
  } else if (top === 2 && second === 2) {
    handType = "two_pair";
    scoring = cardsWithCount(byRank, 2);
  } else if (top === 2) {
    handType = "pair";
    scoring = cardsWithCount(byRank, 2);
  } else {
    handType = "high_card";
    // Stones are rank-less and never qualify as the highest card. If every card is stone
    // (degenerate but reachable) there's no rank-bearing card to score on its own — fall
    // back to the first played card so we always emit a single high-card id.
    scoring = nonStone.length > 0 ? [highestCard(nonStone)] : [played[0]!];
  }

  // PET-75: stone cards always score (they contribute +50 chips per stone via the modifier
  // pre-pass), even when the hand type would otherwise exclude kickers. Re-add them.
  const scoringSet = new Set(scoring.map((c) => c.id));
  for (const c of played) {
    if (c.enhancement === "stone") scoringSet.add(c.id);
  }
  // Emit scoring ids in INPUT order so the UI highlight is stable.
  const scoringCardIds = played.filter((c) => scoringSet.has(c.id)).map((c) => c.id);

  return { handType, scoringCardIds };
}
