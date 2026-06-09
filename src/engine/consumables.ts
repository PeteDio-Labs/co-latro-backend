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
export const CONSUMABLES: ConsumableDef[] = [
  {
    id: "the_fool",
    name: "The Fool",
    description: "Creates a copy of the last consumable used (Tarot or Planet).",
    kind: "tarot",
    cost: 3,
    effect: { kind: "copy_last_consumable" },
  },
  {
    id: "the_magician",
    name: "The Magician",
    description: "Enhances 2 selected cards to Lucky",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 2, max: 2, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "lucky", count: 2 },
  },
  {
    id: "the_high_priestess",
    name: "The High Priestess",
    description: "Creates up to 2 random Planet cards",
    kind: "tarot",
    cost: 3,
    effect: { kind: "create_consumable", kind2: "planet", count: 2 },
  },
  {
    id: "the_empress",
    name: "The Empress",
    description: "Enhances 2 selected cards to Mult",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 2, max: 2, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "mult", count: 2 },
  },
  {
    id: "the_emperor",
    name: "The Emperor",
    description: "Creates up to 2 random Tarot cards",
    kind: "tarot",
    cost: 3,
    effect: { kind: "create_consumable", kind2: "tarot", count: 2 },
  },
  {
    id: "the_hierophant",
    name: "The Hierophant",
    description: "Enhances 2 selected cards to Bonus",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 2, max: 2, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "bonus", count: 2 },
  },
  {
    id: "the_lovers",
    name: "The Lovers",
    description: "Enhances 1 selected card to Wild",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "wild", count: 1 },
  },
  {
    id: "the_chariot",
    name: "The Chariot",
    description: "Enhances 1 selected card to Steel",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "steel", count: 1 },
  },
  {
    id: "justice",
    name: "Justice",
    description: "Enhances 1 selected card to Glass",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "glass", count: 1 },
  },
  {
    id: "the_hermit",
    name: "The Hermit",
    description: "Doubles money (max +$20)",
    kind: "tarot",
    cost: 3,
    effect: { kind: "double_money", cap: 20 },
  },
  {
    id: "the_wheel_of_fortune",
    name: "The Wheel of Fortune",
    description: "1 in 4 chance to add Foil, Holographic, or Polychrome edition to a random Joker.",
    kind: "tarot",
    cost: 3,
    effect: { kind: "wheel_of_fortune_chance", pool: ["foil", "holo", "poly"], chance: 0.25 },
  },
  {
    id: "strength",
    name: "Strength",
    description: "Increases the rank of up to 2 selected cards by 1",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 2, from: "hand" },
    effect: { kind: "increase_rank_selected", max: 2 },
  },
  {
    id: "the_hanged_man",
    name: "The Hanged Man",
    description: "Destroys up to 2 selected cards",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 2, from: "hand" },
    effect: { kind: "destroy_selected", max: 2 },
  },
  {
    id: "death",
    name: "Death",
    description: "Copies the second selected card onto the first",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 2, max: 2, from: "hand" },
    effect: { kind: "copy_card" },
  },
  {
    id: "temperance",
    name: "Temperance",
    description: "Gives money equal to total sell value of jokers (max $50)",
    kind: "tarot",
    cost: 3,
    effect: { kind: "sell_jokers_value", cap: 50 },
  },
  {
    id: "the_devil",
    name: "The Devil",
    description: "Enhances 1 selected card to Gold",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "gold", count: 1 },
  },
  {
    id: "the_tower",
    name: "The Tower",
    description: "Enhances 1 selected card to Stone",
    kind: "tarot",
    cost: 3,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "enhance_selected", enhancement: "stone", count: 1 },
  },

  // ----- Spectral catalog (PET-72). All spectrals cost 4 and stay catalog-only for now
  // (shop filters them out — they only enter a run via The High Priestess kind2:"spectral"
  // path or future Spectral booster packs in PET-70).
  {
    id: "familiar",
    name: "Familiar",
    description: "Destroys 1 random card in hand, adds 3 random face cards to your deck",
    kind: "spectral",
    cost: 4,
    effect: { kind: "familiar", destroy: 1, add: 3 },
  },
  {
    id: "grim",
    name: "Grim",
    description: "Destroys 1 random card in hand, adds 2 random Aces to your deck",
    kind: "spectral",
    cost: 4,
    effect: { kind: "grim", destroy: 1, add: 2 },
  },
  {
    id: "incantation",
    name: "Incantation",
    description: "Destroys 1 random card in hand, adds 4 random numbered (2-9) cards to your deck",
    kind: "spectral",
    cost: 4,
    effect: { kind: "incantation", destroy: 1, add: 4 },
  },
  {
    id: "talisman",
    name: "Talisman",
    description: "Adds a Gold Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "seal_selected", seal: "gold", count: 1 },
  },
  {
    id: "aura",
    name: "Aura",
    description: "Add Foil, Holographic, or Polychrome effect to a random Joker.",
    kind: "spectral",
    cost: 4,
    effect: { kind: "apply_joker_edition_random", pool: ["foil", "holo", "poly"] },
  },
  {
    id: "wraith",
    name: "Wraith",
    description: "Creates a random Rare Joker, sets your money to $0",
    kind: "spectral",
    cost: 4,
    effect: { kind: "wraith" },
  },
  {
    id: "sigil",
    name: "Sigil",
    description: "Converts all cards in hand to a single random suit",
    kind: "spectral",
    cost: 4,
    effect: { kind: "suit_convert_hand" },
  },
  {
    id: "ouija",
    name: "Ouija",
    description: "Converts all cards in hand to a single random rank, -1 hand size",
    kind: "spectral",
    cost: 4,
    effect: { kind: "rank_convert_hand", handSizeDelta: -1 },
  },
  {
    id: "ectoplasm",
    name: "Ectoplasm",
    description: "Add Negative edition to a random Joker. (-1 hand size deferred.)",
    kind: "spectral",
    cost: 4,
    effect: { kind: "apply_joker_edition_negative" },
  },
  {
    id: "immolate",
    name: "Immolate",
    description: "Destroys 5 random cards in hand, gain $20",
    kind: "spectral",
    cost: 4,
    effect: { kind: "immolate", destroy: 5, money: 20 },
  },
  {
    id: "ankh",
    name: "Ankh",
    description: "Creates a copy of a random Joker, destroys all other Jokers",
    kind: "spectral",
    cost: 4,
    effect: { kind: "ankh" },
  },
  {
    id: "deja_vu",
    name: "Déjà Vu",
    description: "Adds a Red Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "seal_selected", seal: "red", count: 1 },
  },
  {
    id: "hex",
    name: "Hex",
    description: "Add Polychrome edition to a random Joker; destroy all other Jokers.",
    kind: "spectral",
    cost: 4,
    effect: { kind: "apply_joker_edition_polychrome_destroy_others", lose_all_money: false },
  },
  {
    id: "trance",
    name: "Trance",
    description: "Adds a Blue Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "seal_selected", seal: "blue", count: 1 },
  },
  {
    id: "medium",
    name: "Medium",
    description: "Adds a Purple Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "seal_selected", seal: "purple", count: 1 },
  },
  {
    id: "cryptid",
    name: "Cryptid",
    description: "Creates 2 copies of 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: { min: 1, max: 1, from: "hand" },
    effect: { kind: "cryptid_duplicate", copies: 2 },
  },
];

export const CONSUMABLE_BY_ID = new Map<string, ConsumableDef>(
  CONSUMABLES.map((c) => [c.id, c]),
);

/** Public helper for content streams that roll a sub-kind (e.g. The Emperor → tarot, High Priestess → planet). */
export function consumablesByKind(kind: ConsumableKind): ConsumableDef[] {
  return CONSUMABLES.filter((c) => c.kind === kind);
}
