/**
 * Booster pack catalog — Balatro's 5 pack kinds × 3 sizes = 15 SKUs.
 *
 * PURE DATA. Packs roll into shop slots like other ShopItem variants. Buying a pack
 * transitions the run into the "pack_open" status with a generated contents pool;
 * the player picks N-of-M (or skips) via the engine's pickFromPack/skipPack helpers.
 *
 * Sizing (Balatro-faithful, see ShopItem rolling in shop.ts):
 *   normal: 1 pick / 3 (joker/spectral: /2) contents @ $4
 *   jumbo:  1 pick / 5 (joker/spectral: /4) contents @ $6
 *   mega:   2 picks / 5 (joker/spectral: /4) contents @ $8
 */

export type PackKind = "arcana" | "celestial" | "buffoon" | "spectral" | "standard";
export type PackSize = "normal" | "jumbo" | "mega";

export interface PackDef {
  id: string;
  name: string;
  kind: PackKind;
  size: PackSize;
  cost: number;
  /** How many items the player may pick from `contents`. */
  choices: number;
  /** How many items are presented to choose from. */
  contents: number;
}

/** Tarot/Planet/Standard share the "wide" sizing; Buffoon/Spectral are slimmer (rarer item pools). */
const ARCANA_SIZES: Array<[PackSize, number, number, number]> = [
  ["normal", 4, 1, 3],
  ["jumbo", 6, 1, 5],
  ["mega", 8, 2, 5],
];
const BUFFOON_SIZES: Array<[PackSize, number, number, number]> = [
  ["normal", 4, 1, 2],
  ["jumbo", 6, 1, 4],
  ["mega", 8, 2, 4],
];

function build(
  kind: PackKind,
  prettyName: string,
  sizes: Array<[PackSize, number, number, number]>,
): PackDef[] {
  return sizes.map(([size, cost, choices, contents]) => ({
    id: `${kind}_${size}`,
    name:
      size === "normal"
        ? `${prettyName} Pack`
        : `${size === "jumbo" ? "Jumbo" : "Mega"} ${prettyName} Pack`,
    kind,
    size,
    cost,
    choices,
    contents,
  }));
}

export const PACKS: PackDef[] = [
  ...build("arcana", "Arcana", ARCANA_SIZES),
  ...build("celestial", "Celestial", ARCANA_SIZES),
  ...build("buffoon", "Buffoon", BUFFOON_SIZES),
  ...build("spectral", "Spectral", BUFFOON_SIZES),
  ...build("standard", "Standard", ARCANA_SIZES),
];

export const PACK_BY_ID = new Map<string, PackDef>(PACKS.map((p) => [p.id, p]));

/** Pick the canonical pack id for a tag's `packKind` (free_pack tag → kind label). Returns the normal-size SKU. */
export function packIdForKind(kind: PackKind): string {
  return `${kind}_normal`;
}

// ---- pack-opening state model -------------------------------------------------

import type { CardEdition, CardEnhancement, CardSeal, Rank, Suit } from "../cards.ts";
import type { HandType } from "../scoring.ts";

/** One choice inside an opened booster pack. Discriminated by `kind` for the picker route. */
export type PackChoiceItem =
  | { kind: "tarot"; id: string; defId: string; name: string; description: string }
  | { kind: "spectral"; id: string; defId: string; name: string; description: string }
  | { kind: "planet"; id: string; planet: string; hand: HandType; name: string; description: string }
  | { kind: "joker"; id: string; jokerId: string; name: string; description: string }
  | {
      kind: "playing_card";
      id: string;
      rank: Rank;
      suit: Suit;
      faceCode: string;
      enhancement?: CardEnhancement;
      edition?: CardEdition;
      seal?: CardSeal;
      name: string;
      description: string;
    };

/** Transient pack-opening state. Lives on RunState until the pack is fully picked or skipped. */
export interface OpeningPack {
  packId: string;
  packKind: PackKind;
  size: PackSize;
  /** N-of-M: how many picks the player has left from `contents`. */
  remainingPicks: number;
  /** The pool the player is choosing from. Items are removed as they're picked. */
  contents: PackChoiceItem[];
  /** Status the run returns to once the pack closes (skip OR all picks consumed). */
  returnStatus: "shop" | "selecting_blind";
}
