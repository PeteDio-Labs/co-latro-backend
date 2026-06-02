/** Preset deck catalog (Balatro-style). Static — no DB, no editing. A deck = perk + face multiset. */

import { faceCode, standardFaces, type Face } from "../cards.ts";
import { GameError } from "./errors.ts";

export interface DeckPerk {
  extraHands?: number;
  extraDiscards?: number;
  startMoney?: number;
}

export interface DeckDef {
  id: string;
  name: string;
  description: string;
  perk: DeckPerk;
  composition: string[]; // face codes (duplicates allowed)
}

export interface DeckSummary {
  id: string;
  name: string;
  description: string;
  perk: DeckPerk;
  size: number;
}

const toCodes = (faces: Face[]): string[] => faces.map(faceCode);

const STANDARD = toCodes(standardFaces());
// Abandoned: drop J/Q/K (keep 2-10 + Ace) → 40 cards.
const NO_FACES = toCodes(standardFaces().filter((f) => f.rank <= 10 || f.rank === 14));
// Checkered: only ♥/♠, two copies of each → 26 + 26 = 52 (exercises duplicate faces).
const CHECKERED = toCodes(
  standardFaces()
    .filter((f) => f.suit === "hearts" || f.suit === "spades")
    .flatMap((f) => [f, f]),
);

export const DECKS: DeckDef[] = [
  { id: "standard", name: "Standard Deck", description: "The classic 52 cards.", perk: {}, composition: STANDARD },
  { id: "red", name: "Red Deck", description: "+1 discard each round.", perk: { extraDiscards: 1 }, composition: STANDARD },
  { id: "blue", name: "Blue Deck", description: "+1 hand each round.", perk: { extraHands: 1 }, composition: STANDARD },
  { id: "yellow", name: "Yellow Deck", description: "Start with an extra $10.", perk: { startMoney: 10 }, composition: STANDARD },
  { id: "abandoned", name: "Abandoned Deck", description: "No face cards (J/Q/K) — 40 cards.", perk: {}, composition: NO_FACES },
  { id: "checkered", name: "Checkered Deck", description: "Only ♥ and ♠ — 26 each.", perk: {}, composition: CHECKERED },
];

const BY_ID = new Map(DECKS.map((d) => [d.id, d]));

export function listDecks(): DeckSummary[] {
  return DECKS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    perk: d.perk,
    size: d.composition.length,
  }));
}

export function getDeck(id: string): DeckDef {
  const deck = BY_ID.get(id);
  if (!deck) throw new GameError(400, "invalid_deck", `Unknown deck: ${id}`);
  return deck;
}
