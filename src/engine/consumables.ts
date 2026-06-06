/**
 * Consumables catalog — Tarot, Planet (consumable kind), Spectral cards held in the run's
 * consumable slots (separate from the Planet shop items in shop.ts, which level hands directly).
 *
 * PURE DATA. Content streams (PET-71 tarots, PET-72 spectrals, etc.) populate CONSUMABLES.
 * Effects are intentionally unknown here — each content stream defines its own discriminated
 * union of effect descriptors and the handler that interprets them.
 */

export type ConsumableKind = "tarot" | "planet" | "spectral";

export interface ConsumableInstance {
  id: string; // per-run instance id (uuid) — distinguishes two of the same defId in slots
  defId: string; // lookup into CONSUMABLE_BY_ID
}

export interface ConsumableDef {
  id: string;
  name: string;
  description: string;
  kind: ConsumableKind;
  /** Shop cost when sold via the shop. */
  cost: number;
  /** If set, /use requires a card selection from the given pool. */
  needsSelection?: { min: number; max: number; from: "hand" | "owned_jokers" };
  /** Effect descriptor — open shape, content streams define their union. */
  effect: unknown;
}

export const CONSUMABLES: ConsumableDef[] = [];

export const CONSUMABLE_BY_ID = new Map<string, ConsumableDef>(
  CONSUMABLES.map((c) => [c.id, c]),
);
