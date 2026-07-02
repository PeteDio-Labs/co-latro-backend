/**
 * Card model + deck helpers. Pure, no game state.
 *
 * A card id is a stable two-char code: rank-char + suit-char (e.g. "KH", "TS", "2C").
 * It is unique within a 52-card deck, so a Set<string> of ids is unambiguous — the
 * client uses ids both as the selection key and to highlight scoring cards.
 */

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

/** Numeric rank for ordering / straight math. 11=J 12=Q 13=K 14=A. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** Per-card modifiers (Balatro). All optional; absent === plain card (no behavior change). */
export type CardEnhancement = "bonus" | "mult" | "wild" | "glass" | "steel" | "stone" | "gold" | "lucky";
export type CardEdition = "foil" | "holo" | "poly" | "negative";
export type CardSeal = "red" | "blue" | "gold" | "purple";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  enhancement?: CardEnhancement;
  edition?: CardEdition;
  seal?: CardSeal;
  /**
   * Boss-effect overlay (PET-83). True while a card is dealt face-down by The Wheel / The Mark.
   * Face-down cards display as a hidden back, contribute nothing to scoring, and are revealed
   * (flipped to false) when played — so the play animation can show what they actually were.
   */
  faceDown?: boolean;
  /**
   * Boss-effect overlay (PET-239). True while the card is debuffed (The Club/Goad/Window/Head,
   * The Plant, The Pillar, Verdant Leaf). Debuffed cards still SHAPE the poker hand but score
   * no chips and trigger no enhancements/editions/seals/jokers. Computed per-view (toRunDTO /
   * scoring) from the run's boss state — never persisted onto the deck.
   */
  debuffed?: boolean;
}

export const ALL_SUITS: readonly Suit[] = ["clubs", "diamonds", "hearts", "spades"];
export const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Single-char rank code used inside card ids (10 -> "T"). */
const RANK_CHAR: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "T", 11: "J", 12: "Q", 13: "K", 14: "A",
};

/** Human-facing rank label (10 -> "10"). */
export const RANK_LABEL: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

const SUIT_CHAR: Record<Suit, string> = {
  clubs: "C", diamonds: "D", hearts: "H", spades: "S",
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠",
};

/** Balatro chip value of a card by rank: Ace 11, J/Q/K 10, number cards = pip value. */
export function chipValue(rank: Rank): number {
  if (rank === 14) return 11; // Ace
  if (rank >= 11) return 10; // J / Q / K
  return rank; // 2..10
}

/** An ordered, unshuffled standard 52-card deck. */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ id: `${RANK_CHAR[rank]}${SUIT_CHAR[suit]}`, rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

// ---- faces + deck composition (Sprint 3: preset decks may hold duplicate faces) ----

/** A card "face" = rank + suit, with no instance identity. Decks are multisets of faces. */
export interface Face {
  rank: Rank;
  suit: Suit;
}

const CHAR_RANK: Record<string, Rank> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};
const CHAR_SUIT: Record<string, Suit> = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" };

/** Compact face code, e.g. "KH", "TS", "2C" — how decks are stored. */
export function faceCode(face: Face): string {
  return `${RANK_CHAR[face.rank]}${SUIT_CHAR[face.suit]}`;
}

export function parseFace(code: string): Face {
  const rank = CHAR_RANK[code[0] ?? ""];
  const suit = CHAR_SUIT[code[1] ?? ""];
  if (rank === undefined || suit === undefined) throw new Error(`bad face code: ${code}`);
  return { rank, suit };
}

/** The standard 52 as faces — the base for building preset compositions. */
export function standardFaces(): Face[] {
  return ALL_SUITS.flatMap((suit) => ALL_RANKS.map((rank) => ({ rank, suit })));
}

/**
 * Build Card[] with UNIQUE per-instance ids from a face multiset (duplicates allowed).
 * id = `${faceCode}-${n}` (counter per face code), so two King-of-Hearts → "KH-0","KH-1".
 */
export function instantiateDeck(faces: readonly Face[]): Card[] {
  const seen = new Map<string, number>();
  return faces.map((face) => {
    const code = faceCode(face);
    const n = seen.get(code) ?? 0;
    seen.set(code, n + 1);
    return { id: `${code}-${n}`, rank: face.rank, suit: face.suit };
  });
}
