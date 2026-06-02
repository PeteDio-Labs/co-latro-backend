/**
 * Joker catalog. PURE DATA — effects are serializable descriptors (no closures), because RunState
 * (which stores joker ids) is JSON-persisted. The scoring fold in scoring.ts interprets these.
 */

import type { Suit } from "../cards.ts";
import type { HandType } from "../scoring.ts";
import { GameError } from "./errors.ts";

export type JokerRarity = "common" | "uncommon" | "rare";

/** "Contains" features (subset matching, computed by scoring.handFeatures). */
export type HandFeature = "pair" | "two_pair" | "three_of_a_kind" | "straight" | "flush";

export type JokerEffect =
  | { kind: "flat_mult"; mult: number }
  | { kind: "flat_chips"; chips: number }
  | { kind: "per_suit_mult"; suit: Suit; mult: number } // × scored cards of suit
  | { kind: "contains_mult"; feature: HandFeature; mult: number }
  | { kind: "contains_chips"; feature: HandFeature; chips: number }
  | { kind: "hand_size_mult"; maxCards: number; mult: number } // if played.length <= maxCards
  | { kind: "per_face_chips"; chips: number } // × scored J/Q/K
  | { kind: "per_parity_mult"; parity: "even" | "odd"; mult: number } // × scored cards of parity
  | { kind: "per_parity_chips"; parity: "even" | "odd"; chips: number }
  | { kind: "per_joker_mult"; mult: number } // × owned joker count
  | { kind: "per_remaining_discard_chips"; chips: number } // × discards remaining
  | { kind: "x_mult_contains"; feature: HandFeature; xMult: number }; // multiply running mult

export interface JokerDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  rarity: JokerRarity;
  effect: JokerEffect;
}

export const MAX_JOKERS = 5;

export function sellValue(cost: number): number {
  return Math.max(1, Math.floor(cost / 2));
}

// Parity is by numeric rank: even = rank % 2 === 0 (10, Q=12 even; A=14 even — see note).
// Note: Ace (14) is even by numeric parity; face = ranks 11..13 (J/Q/K), Ace is NOT a face.
export const JOKERS: JokerDef[] = [
  { id: "joker", name: "Joker", description: "+4 Mult", cost: 2, rarity: "common", effect: { kind: "flat_mult", mult: 4 } },
  { id: "greedy_joker", name: "Greedy Joker", description: "+3 Mult per ♦ scored", cost: 5, rarity: "common", effect: { kind: "per_suit_mult", suit: "diamonds", mult: 3 } },
  { id: "lusty_joker", name: "Lusty Joker", description: "+3 Mult per ♥ scored", cost: 5, rarity: "common", effect: { kind: "per_suit_mult", suit: "hearts", mult: 3 } },
  { id: "wrathful_joker", name: "Wrathful Joker", description: "+3 Mult per ♠ scored", cost: 5, rarity: "common", effect: { kind: "per_suit_mult", suit: "spades", mult: 3 } },
  { id: "gluttonous_joker", name: "Gluttonous Joker", description: "+3 Mult per ♣ scored", cost: 5, rarity: "common", effect: { kind: "per_suit_mult", suit: "clubs", mult: 3 } },
  { id: "jolly_joker", name: "Jolly Joker", description: "+8 Mult if hand has a Pair", cost: 3, rarity: "common", effect: { kind: "contains_mult", feature: "pair", mult: 8 } },
  { id: "zany_joker", name: "Zany Joker", description: "+12 Mult if hand has Three of a Kind", cost: 4, rarity: "common", effect: { kind: "contains_mult", feature: "three_of_a_kind", mult: 12 } },
  { id: "mad_joker", name: "Mad Joker", description: "+10 Mult if hand has Two Pair", cost: 4, rarity: "common", effect: { kind: "contains_mult", feature: "two_pair", mult: 10 } },
  { id: "crazy_joker", name: "Crazy Joker", description: "+12 Mult if hand has a Straight", cost: 4, rarity: "common", effect: { kind: "contains_mult", feature: "straight", mult: 12 } },
  { id: "droll_joker", name: "Droll Joker", description: "+10 Mult if hand has a Flush", cost: 4, rarity: "common", effect: { kind: "contains_mult", feature: "flush", mult: 10 } },
  { id: "sly_joker", name: "Sly Joker", description: "+50 Chips if hand has a Pair", cost: 3, rarity: "common", effect: { kind: "contains_chips", feature: "pair", chips: 50 } },
  { id: "clever_joker", name: "Clever Joker", description: "+80 Chips if hand has Two Pair", cost: 4, rarity: "common", effect: { kind: "contains_chips", feature: "two_pair", chips: 80 } },
  { id: "crafty_joker", name: "Crafty Joker", description: "+80 Chips if hand has a Flush", cost: 4, rarity: "common", effect: { kind: "contains_chips", feature: "flush", chips: 80 } },
  { id: "half_joker", name: "Half Joker", description: "+20 Mult if 3 or fewer cards played", cost: 5, rarity: "common", effect: { kind: "hand_size_mult", maxCards: 3, mult: 20 } },
  { id: "scary_face", name: "Scary Face", description: "+30 Chips per face card scored", cost: 4, rarity: "common", effect: { kind: "per_face_chips", chips: 30 } },
  { id: "even_steven", name: "Even Steven", description: "+4 Mult per even card scored", cost: 4, rarity: "common", effect: { kind: "per_parity_mult", parity: "even", mult: 4 } },
  { id: "odd_todd", name: "Odd Todd", description: "+31 Chips per odd card scored", cost: 4, rarity: "common", effect: { kind: "per_parity_chips", parity: "odd", chips: 31 } },
  { id: "abstract_joker", name: "Abstract Joker", description: "+3 Mult per Joker owned", cost: 4, rarity: "uncommon", effect: { kind: "per_joker_mult", mult: 3 } },
  { id: "banner", name: "Banner", description: "+30 Chips per remaining discard", cost: 5, rarity: "common", effect: { kind: "per_remaining_discard_chips", chips: 30 } },
  { id: "the_duo", name: "The Duo", description: "×2 Mult if hand has a Pair", cost: 8, rarity: "rare", effect: { kind: "x_mult_contains", feature: "pair", xMult: 2 } },
];

const BY_ID = new Map(JOKERS.map((j) => [j.id, j]));

export function listJokers(): JokerDef[] {
  return JOKERS.slice();
}

export function getJoker(id: string): JokerDef {
  const joker = BY_ID.get(id);
  if (!joker) throw new GameError(400, "unknown_joker", `Unknown joker: ${id}`);
  return joker;
}
