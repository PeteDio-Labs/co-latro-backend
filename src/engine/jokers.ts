/**
 * Joker catalog. PURE DATA — effects are serializable descriptors (no closures), because RunState
 * (which stores joker ids) is JSON-persisted. The scoring fold in scoring.ts interprets these.
 */

import type { Suit } from "../cards.ts";
import type { HandType } from "../scoring.ts";
import { GameError } from "./errors.ts";
import { Glob } from "bun";

export type JokerRarity = "common" | "uncommon" | "rare";

/** "Contains" features (subset matching, computed by scoring.handFeatures). */
export type HandFeature = "pair" | "two_pair" | "three_of_a_kind" | "straight" | "flush";

export type JokerEffect =
  | { kind: "flat_mult"; mult: number }
  | { kind: "flat_chips"; chips: number }
  | { kind: "per_suit_mult"; suit: Suit; mult: number } // × scored cards of suit
  | { kind: "per_suit_chips"; suit: Suit; chips: number } // × scored cards of suit
  | { kind: "contains_mult"; feature: HandFeature; mult: number }
  | { kind: "contains_chips"; feature: HandFeature; chips: number }
  | { kind: "hand_size_mult"; maxCards: number; mult: number } // if played.length <= maxCards
  | { kind: "per_face_chips"; chips: number } // × scored J/Q/K
  | { kind: "per_parity_mult"; parity: "even" | "odd"; mult: number } // × scored cards of parity
  | { kind: "per_parity_chips"; parity: "even" | "odd"; chips: number }
  | { kind: "per_joker_mult"; mult: number } // × owned joker count
  | { kind: "per_remaining_discard_chips"; chips: number } // × discards remaining
  | { kind: "x_mult_contains"; feature: HandFeature; xMult: number } // multiply running mult
  | { kind: "retrigger_face" } // face cards (J/Q/K) score chips twice (scoring-card pre-pass)
  // PET-230 Bucket-B: generalized retriggering beyond retrigger_face — same "score chips
  // (1 + N) times" mechanism as retrigger_face, gated on a different condition per kind.
  | { kind: "retrigger_rank"; ranks: number[] } // scored cards whose rank is in `ranks` retrigger once
  | { kind: "retrigger_final_hand" } // on the LAST hand of the round (handsRemaining <= 1), all scored cards retrigger once
  | { kind: "retrigger_held" } // retriggers HELD-in-hand card abilities once more (e.g. steel's ×1.5 stacks an extra time)
  | { kind: "scaling_per_blind_mult"; mult: number } // +mult × counter (counter++ each blind cleared)
  | { kind: "scaling_per_blind_chips"; chips: number } // +chips × counter (counter++ each blind cleared)
  | { kind: "economy_per_hand_played"; dollars: number } // $N at end of each playHand
  | { kind: "on_discard_chips"; chips: number } // +chips × discardsUsedThisBlind
  | { kind: "flat_chips_and_mult"; chips: number; mult: number } // both at once
  | { kind: "per_5_dollars_mult"; mult: number } // +mult × floor(money / 5)
  // PET-229: unconditional +mult (scored like flat_mult); separately, at end of round, a
  // chancePct-in-100 roll (src/engine/prng.ts rollChance) may fire onFail. Shared shape for
  // every "flat Mult + chance to X" joker (Gros Michel, Cavendish, ...).
  | { kind: "chance_mult"; mult: number; chancePct: number; onFail?: "destroy_self" }
  // PET-231: ×xMult per card of `rank` still HELD in hand (not played) — compounds as
  // xMult^N, same "cards in hand" side channel steel enhancement reads (ctx.handHeld).
  // Shared shape for every "×Mult per rank held" joker (Baron, ...).
  | { kind: "held_rank_x_mult"; rank: number; xMult: number };

/** Effect kinds whose state lives in run.jokerStates[id] = { counter }. */
export function isScalingEffect(effect: JokerEffect): boolean {
  return effect.kind === "scaling_per_blind_mult" || effect.kind === "scaling_per_blind_chips";
}

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
// Catalog assembled from ./jokers/*.ts — ONE FILE PER JOKER (PET-216). An additive entry
// is a NEW file, never an edit to this shared array, so additive PRs cannot merge-conflict.
// Assembled synchronously at module load, sorted by id for a stable, deterministic order.
// (Files prefixed "_" are helpers, not entries.)
const _jokerDir = new URL("./jokers/", import.meta.url).pathname;
const _jokerFiles = [...new Glob("*.ts").scanSync({ cwd: _jokerDir, absolute: true })]
  .filter((f) => !(f.split("/").pop() ?? "").startsWith("_"))
  .sort();
export const JOKERS: JokerDef[] = _jokerFiles.map((f) => require(f).default as JokerDef);

const BY_ID = new Map(JOKERS.map((j) => [j.id, j]));

export function listJokers(): JokerDef[] {
  return JOKERS.slice();
}

export function getJoker(id: string): JokerDef {
  const joker = BY_ID.get(id);
  if (!joker) throw new GameError(400, "unknown_joker", `Unknown joker: ${id}`);
  return joker;
}
