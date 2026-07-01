/**
 * Consumables catalog — Tarot (PET-71), Planet (consumable kind, future), Spectral (PET-72)
 * cards held in the run's consumable slots (separate from the Planet shop items in shop.ts,
 * which level hands directly).
 *
 * PURE DATA. The effect descriptors below are a discriminated union; the handler in run.ts
 * (useConsumable) interprets each `kind`. Two-step effects that need a card selection set
 * `needsSelection` so the route can validate before calling into the engine.
 */

import type { CardEdition, CardEnhancement, CardSeal } from "../cards.ts";
import { Glob } from "bun";

export type ConsumableKind = "tarot" | "planet" | "spectral";

export interface ConsumableInstance {
  id: string; // per-run instance id (uuid) — distinguishes two of the same defId in slots
  defId: string; // lookup into CONSUMABLE_BY_ID
}

/**
 * Discriminated union of consumable effects. Each `kind` is interpreted by useConsumable
 * in run.ts. The `kind2` field on `create_consumable` disambiguates from the outer `kind`
 * discriminator (the inner sub-kind names the consumable category to roll).
 */
export type ConsumableEffect =
  | { kind: "enhance_selected"; enhancement: CardEnhancement; count: number }
  | { kind: "edition_selected"; edition: CardEdition; count: number }
  | { kind: "seal_selected"; seal: CardSeal; count: number }
  | { kind: "create_consumable"; kind2: ConsumableKind; count: number }
  | { kind: "destroy_selected"; max: number }
  | { kind: "level_random_hand"; n: number }
  | { kind: "double_money"; cap: number }
  | { kind: "sell_jokers_value"; cap: number }
  | { kind: "increase_rank_selected"; max: number }
  | { kind: "copy_card" }
  /** The Fool: spawn a fresh instance of the last Tarot/Planet consumable used this run. */
  | { kind: "copy_last_consumable" }
  // ----- spectral additions (PET-72) -----
  /** Destroy N random cards from the hand (no selection). */
  | { kind: "destroy_random_cards"; n: number }
  /** Familiar: destroy 1 random hand card + add `add` random face cards (J/Q/K) to the deck. */
  | { kind: "familiar"; destroy: number; add: number }
  /** Grim: destroy 1 random hand card + add `add` random Aces to the deck. */
  | { kind: "grim"; destroy: number; add: number }
  /** Incantation: destroy 1 random hand card + add `add` random numbered (2-9) cards to the deck. */
  | { kind: "incantation"; destroy: number; add: number }
  /** Sigil: convert every card currently in hand to a single random suit (persisted in deckComposition). */
  | { kind: "suit_convert_hand" }
  /**
   * Ouija: convert every card currently in hand to a single random rank (persisted in
   * deckComposition). Optional `handSizeDelta` shifts the run's permanent handSizeOffset
   * by that amount (Ouija: -1) — applied AFTER the rank conversion.
   */
  | { kind: "rank_convert_hand"; handSizeDelta?: number }
  /** Immolate: destroy 5 random hand cards + gain $20. */
  | { kind: "immolate"; destroy: number; money: number }
  /** Wraith: gain a random Rare joker, then set money to 0 (downside). */
  | { kind: "wraith" }
  /** Ankh: duplicate one random owned joker, destroy the rest. */
  | { kind: "ankh" }
  /** Cryptid: duplicate the selected card N times (added to deckComposition + hand if space). */
  | { kind: "cryptid_duplicate"; copies: number }
  /** Destroy N random owned jokers (no-op if none owned). */
  | { kind: "destroy_random_jokers"; n: number }
  /** Set the run's money to 0 (downside primitive — reused by Wraith if composed). */
  | { kind: "lose_all_money" }
  // ----- joker-edition effects (PET-67) -----
  /**
   * Aura pattern: apply a random edition (from `pool`) to a random owned joker. Prefers
   * jokers without an existing edition; falls back to any if all are editioned.
   */
  | { kind: "apply_joker_edition_random"; pool: ("foil" | "holo" | "poly")[] }
  /** Ectoplasm pattern: apply Negative to a random owned joker (overwrites any edition). */
  | { kind: "apply_joker_edition_negative" }
  /**
   * Hex pattern: apply Polychrome to one random owned joker and destroy every OTHER joker
   * (their states/editions cleared). Optionally also zero the run's money (Wraith composes
   * via lose_all_money — Hex itself does NOT zero money).
   */
  | { kind: "apply_joker_edition_polychrome_destroy_others"; lose_all_money: boolean }
  /**
   * Wheel of Fortune pattern: `chance` chance to apply a random edition (from `pool`) to a
   * random owned joker; otherwise no-op. Consumable is consumed regardless.
   */
  | { kind: "wheel_of_fortune_chance"; pool: ("foil" | "holo" | "poly")[]; chance: number }
  | { kind: "noop" };

export interface ConsumableDef {
  id: string;
  name: string;
  description: string;
  kind: ConsumableKind;
  /** Shop cost when sold via the shop. */
  cost: number;
  /** If set, /use requires a card selection from the given pool. */
  needsSelection?: { min: number; max: number; from: "hand" | "owned_jokers" };
  /** Effect descriptor — useConsumable in run.ts interprets this. */
  effect: ConsumableEffect;
}

/** Tarot catalog — Balatro's 22 majors, minus a handful deferred (Fool/Wheel are noop stubs). */
// Catalog assembled from ./consumables/*.ts — ONE FILE PER ENTRY (PET-216). Additive entries are
// new files, never a shared-array edit, so additive PRs cannot merge-conflict. Sorted by id.
const _consumablesDir = new URL("./consumables/", import.meta.url).pathname;
const _consumablesFiles = [...new Glob("*.ts").scanSync({ cwd: _consumablesDir, absolute: true })]
  .filter((f) => !(f.split("/").pop() ?? "").startsWith("_"))
  .sort();
export const CONSUMABLES: ConsumableDef[] = _consumablesFiles.map((f) => require(f).default as ConsumableDef);

export const CONSUMABLE_BY_ID = new Map<string, ConsumableDef>(
  CONSUMABLES.map((c) => [c.id, c]),
);

/** Public helper for content streams that roll a sub-kind (e.g. The Emperor → tarot, High Priestess → planet). */
export function consumablesByKind(kind: ConsumableKind): ConsumableDef[] {
  return CONSUMABLES.filter((c) => c.kind === kind);
}
