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
  | "royal_flush";

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

  const byRank = groupBy(played, (c) => c.rank);
  const bySuit = groupBy(played, (c) => c.suit);

  // Rank-count signature, descending: e.g. [4,1], [3,2], [2,2,1], [2,1,1,1], [1,...].
  const counts = [...byRank.values()].map((g) => g.length).sort((a, b) => b - a);
  const top = counts[0] ?? 0;
  const second = counts[1] ?? 0;

  // Flush requires exactly 5 cards of one suit. Straight requires 5 distinct ranks.
  const isFlush = n === 5 && bySuit.size === 1;

  const ranksAsc = played.map((c) => c.rank).sort((a, b) => a - b);
  let isStraight = false;
  if (n === 5 && byRank.size === 5) {
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

  let handType: HandType;
  let scoring: Card[];

  if (isRoyal) {
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
    scoring = [highestCard(played)];
  }

  // Emit scoring ids in INPUT order so the UI highlight is stable.
  const scoringSet = new Set(scoring.map((c) => c.id));
  const scoringCardIds = played.filter((c) => scoringSet.has(c.id)).map((c) => c.id);

  return { handType, scoringCardIds };
}
