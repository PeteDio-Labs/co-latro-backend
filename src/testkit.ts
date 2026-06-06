/** Test helpers: build cards from compact id strings, e.g. cards("KH KS 3D 7C 9S"). */

import type { Card, CardEdition, CardEnhancement, CardSeal, Rank, Suit } from "./cards.ts";

const RANK: Record<string, Rank> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};
const SUIT: Record<string, Suit> = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" };

export function card(id: string): Card {
  const rank = RANK[id[0] ?? ""];
  const suit = SUIT[id[1] ?? ""];
  if (rank === undefined || suit === undefined) throw new Error(`bad card id: ${id}`);
  return { id, rank, suit };
}

export function cards(spec: string): Card[] {
  return spec.trim().split(/\s+/).map(card);
}

/** Sugar for "this card but with these modifiers" (PET-75 tests). */
export function withMod(
  c: Card,
  mods: { enhancement?: CardEnhancement; edition?: CardEdition; seal?: CardSeal },
): Card {
  return { ...c, ...mods };
}
