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
    description: "Creates the last tarot/planet card used (DEFERRED)",
    kind: "tarot",
    cost: 3,
    effect: { kind: "noop" },
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
    description: "1 in 4 chance to add Foil/Holo/Poly to a random Joker (DEFERRED)",
    kind: "tarot",
    cost: 3,
    effect: { kind: "noop" },
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
];

export const CONSUMABLE_BY_ID = new Map<string, ConsumableDef>(
  CONSUMABLES.map((c) => [c.id, c]),
);

/** Public helper for content streams that roll a sub-kind (e.g. The Emperor → tarot, High Priestess → planet). */
export function consumablesByKind(kind: ConsumableKind): ConsumableDef[] {
  return CONSUMABLES.filter((c) => c.kind === kind);
}
