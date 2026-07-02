/**
 * Boss-blind effects catalog + pure helpers (PET-92 / PET-239 / PET-240).
 *
 * Every boss carries a closed-union `effect` kind (matching the joker/tag/consumable idiom).
 * run.ts dispatches off the kind at the right phase:
 *
 *   startBlind  — max_hands, no_discards, force_card_selection, disable_random_joker_per_hand,
 *                 shuffle_jokers, reduce_hand_size (via effectiveHandSize), face_down_* on deal.
 *   playHand    — must_play_n / forbid_hand_type_repeat / single_hand_type / force_card_selection
 *                 validate BEFORE any mutation; level_down_played_hand fires pre-score;
 *                 money_loss_on_play / money_set_on_most_played / repicks fire post-score.
 *   scoring     — debuff_* (via isCardDebuffed → Card.debuffed) and halve_base_target_bonus
 *                 (via ScoreContext.halveBase) fold into scoreHand.
 *   discard     — no_discards (0 budget), force_card_selection, draw_fixed_after_action.
 *   blind end   — checkTransition clears currentBossEffect + transient boss state.
 *
 * Face-down cards are filtered out of the evaluator + scoring fold (see scoring.ts) and are
 * revealed (faceDown → false) when played. Debuffed cards still SHAPE the hand (they count for
 * pair/flush detection) but contribute no chips and trigger no modifiers/jokers — Balatro rules.
 *
 * Ante-8 finisher bosses (`finisher: true`) only roll on the final ante; regular bosses never
 * roll there. RNG always flows through the injected rng seam (PET-207) — no Math.random here.
 */

import { faceCode, type Card, type Suit } from "../cards.ts";
import { MAX_ANTE } from "./ante.ts";

/** Closed union of boss-effect behaviors. Adding a boss that reuses a kind is Bucket-A. */
export type BossEffect =
  // ----- debuff family (PET-239): cards score nothing / reduced -----
  | { kind: "debuff_suit"; suit: Suit }
  | { kind: "debuff_face" }
  | { kind: "debuff_played_this_ante" }
  | { kind: "debuff_all_until_joker_sold" }
  | { kind: "halve_base_target_bonus" }
  | { kind: "reduce_hand_size"; n: number }
  // ----- restriction / state family (PET-240) -----
  | { kind: "must_play_n"; n: number }
  | { kind: "forbid_hand_type_repeat" }
  | { kind: "single_hand_type" }
  | { kind: "level_down_played_hand" }
  | { kind: "money_set_on_most_played"; amount: number }
  | { kind: "no_discards" }
  | { kind: "draw_fixed_after_action"; n: number }
  | { kind: "money_loss_on_play"; dollarsPerCard: number }
  | { kind: "force_card_selection" }
  | { kind: "disable_random_joker_per_hand" }
  | { kind: "shuffle_jokers" }
  // ----- face-down family (PET-83 mechanics unified + PET-240 additions) -----
  | { kind: "face_down_random"; oneIn: number }
  | { kind: "face_down_faces" }
  | { kind: "face_down_first_hand" }
  | { kind: "face_down_after_play" }
  // ----- legacy PET-83 mechanics, unified into the union -----
  | { kind: "max_hands"; n: number }
  | { kind: "discard_on_play"; n: number };

export interface BossEffectDef {
  id: string;
  name: string;
  description: string;
  /** Multiplier applied on top of the boss blind's base target (default 1 = no change). */
  targetMult?: number;
  /** Ante-8 finisher — only rolls on the final ante (regular bosses never roll there). */
  finisher?: boolean;
  /** Mechanical behavior. Absent = target-mult-only boss (The Wall / Violet Vessel). */
  effect?: BossEffect;
}

export const BOSS_EFFECTS: BossEffectDef[] = [
  // ----- PET-83 originals (order preserved — kept first for stable roll indexes) -----
  {
    id: "the_needle",
    name: "The Needle",
    description: "Play only 1 hand.",
    effect: { kind: "max_hands", n: 1 },
  },
  {
    id: "the_wall",
    name: "The Wall",
    description: "Extra-large blind (target ×1.5).",
    targetMult: 1.5,
  },
  {
    id: "the_hook",
    name: "The Hook",
    description: "Discards 2 random cards at the end of each played hand.",
    effect: { kind: "discard_on_play", n: 2 },
  },
  {
    id: "the_wheel",
    name: "The Wheel",
    description: "1 in 7 cards drawn face-down.",
    effect: { kind: "face_down_random", oneIn: 7 },
  },
  {
    id: "the_mark",
    name: "The Mark",
    description: "All face cards start face-down.",
    effect: { kind: "face_down_faces" },
  },

  // ----- debuff family (PET-239) — exemplar: The Club -----
  {
    id: "the_club",
    name: "The Club",
    description: "All Club cards are debuffed.",
    effect: { kind: "debuff_suit", suit: "clubs" },
  },
  {
    id: "the_goad",
    name: "The Goad",
    description: "All Spade cards are debuffed.",
    effect: { kind: "debuff_suit", suit: "spades" },
  },
  {
    id: "the_window",
    name: "The Window",
    description: "All Diamond cards are debuffed.",
    effect: { kind: "debuff_suit", suit: "diamonds" },
  },
  {
    id: "the_head",
    name: "The Head",
    description: "All Heart cards are debuffed.",
    effect: { kind: "debuff_suit", suit: "hearts" },
  },
  {
    id: "the_plant",
    name: "The Plant",
    description: "All face cards are debuffed.",
    effect: { kind: "debuff_face" },
  },
  {
    id: "the_pillar",
    name: "The Pillar",
    description: "Cards played previously this ante are debuffed.",
    effect: { kind: "debuff_played_this_ante" },
  },
  {
    id: "the_flint",
    name: "The Flint",
    description: "Base chips and mult are halved.",
    effect: { kind: "halve_base_target_bonus" },
  },
  {
    id: "the_manacle",
    name: "The Manacle",
    description: "-1 hand size.",
    effect: { kind: "reduce_hand_size", n: 1 },
  },

  // ----- restriction / state family (PET-240) — exemplar: The Psychic -----
  {
    id: "the_psychic",
    name: "The Psychic",
    description: "Must play 5 cards.",
    effect: { kind: "must_play_n", n: 5 },
  },
  {
    id: "the_eye",
    name: "The Eye",
    description: "No repeat hand types this blind.",
    effect: { kind: "forbid_hand_type_repeat" },
  },
  {
    id: "the_mouth",
    name: "The Mouth",
    description: "Play only 1 hand type this blind.",
    effect: { kind: "single_hand_type" },
  },
  {
    id: "the_arm",
    name: "The Arm",
    description: "Decrease level of played poker hand.",
    effect: { kind: "level_down_played_hand" },
  },
  {
    id: "the_ox",
    name: "The Ox",
    description: "Playing your most played hand sets money to $0.",
    effect: { kind: "money_set_on_most_played", amount: 0 },
  },
  {
    id: "the_water",
    name: "The Water",
    description: "Start with 0 discards.",
    effect: { kind: "no_discards" },
  },
  {
    id: "the_serpent",
    name: "The Serpent",
    description: "After playing or discarding, always draw 3 cards.",
    effect: { kind: "draw_fixed_after_action", n: 3 },
  },
  {
    id: "the_fish",
    name: "The Fish",
    description: "Cards drawn face-down after each hand played.",
    effect: { kind: "face_down_after_play" },
  },
  {
    id: "the_house",
    name: "The House",
    description: "First hand is drawn face-down.",
    effect: { kind: "face_down_first_hand" },
  },
  {
    id: "the_tooth",
    name: "The Tooth",
    description: "Lose $1 per card played.",
    effect: { kind: "money_loss_on_play", dollarsPerCard: 1 },
  },

  // ----- ante-8 finishers (PET-240) — only roll on the final ante -----
  {
    id: "amber_acorn",
    name: "Amber Acorn",
    description: "Shuffles your Jokers (order affects scoring).",
    finisher: true,
    effect: { kind: "shuffle_jokers" },
  },
  {
    id: "verdant_leaf",
    name: "Verdant Leaf",
    description: "All cards debuffed until 1 Joker is sold.",
    finisher: true,
    effect: { kind: "debuff_all_until_joker_sold" },
  },
  {
    id: "violet_vessel",
    name: "Violet Vessel",
    description: "Very large blind (target ×3).",
    finisher: true,
    targetMult: 3,
  },
  {
    id: "crimson_heart",
    name: "Crimson Heart",
    description: "One random Joker disabled every hand.",
    finisher: true,
    effect: { kind: "disable_random_joker_per_hand" },
  },
  {
    id: "cerulean_bell",
    name: "Cerulean Bell",
    description: "Forces 1 card to always be selected.",
    finisher: true,
    effect: { kind: "force_card_selection" },
  },
];

export const BOSS_EFFECT_BY_ID = new Map<string, BossEffectDef>(
  BOSS_EFFECTS.map((b) => [b.id, b]),
);

/** Resolve the active boss's effect kind (null when no boss / declarative-only boss). */
export function bossEffectOf(currentBossEffect: string | null): BossEffect | null {
  if (!currentBossEffect) return null;
  return BOSS_EFFECT_BY_ID.get(currentBossEffect)?.effect ?? null;
}

/**
 * Pick a boss effect uniformly from the ante-appropriate pool: finishers on the final ante,
 * regular bosses everywhere else. With an empty pool returns null (safety net).
 */
export function rollBossEffect(ante: number, rng: () => number): string | null {
  const pool = BOSS_EFFECTS.filter((b) => (ante >= MAX_ANTE ? b.finisher === true : !b.finisher));
  if (pool.length === 0) return null;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx]?.id ?? null;
}

/** Extra target multiplier from the active boss effect (default 1 when none / no targetMult). */
export function effectiveBossTargetMult(currentBossEffect: string | null): number {
  if (!currentBossEffect) return 1;
  const def = BOSS_EFFECT_BY_ID.get(currentBossEffect);
  return def?.targetMult ?? 1;
}

/** Where the cards being flipped came from — drives the first-hand / after-play kinds. */
export type FaceDownPhase = "deal" | "draw" | "draw_after_play";

/**
 * Mutate `cards` in place, flipping `faceDown = true` on those affected by the active boss effect:
 *   - face_down_random (The Wheel):        each card has a 1-in-N chance, any phase.
 *   - face_down_faces (The Mark):          every face card (rank 11-13), any phase.
 *   - face_down_first_hand (The House):    every card of the INITIAL deal ("deal" phase only).
 *   - face_down_after_play (The Fish):     every card drawn after a hand was played this blind.
 * All other boss effects (or none) are no-ops. Cards already face-down are left untouched so
 * a redraw doesn't accidentally re-reveal them.
 */
export function applyFaceDownEffect(
  cards: Card[],
  currentBossEffect: string | null,
  rng: () => number,
  phase: FaceDownPhase = "deal",
): void {
  const effect = bossEffectOf(currentBossEffect);
  if (!effect) return;
  switch (effect.kind) {
    case "face_down_random": {
      for (const c of cards) {
        if (c.faceDown) continue;
        if (rng() < 1 / effect.oneIn) c.faceDown = true;
      }
      return;
    }
    case "face_down_faces": {
      for (const c of cards) {
        if (c.faceDown) continue;
        if (c.rank >= 11 && c.rank <= 13) c.faceDown = true;
      }
      return;
    }
    case "face_down_first_hand": {
      if (phase !== "deal") return;
      for (const c of cards) c.faceDown = true;
      return;
    }
    case "face_down_after_play": {
      if (phase !== "draw_after_play") return;
      for (const c of cards) c.faceDown = true;
      return;
    }
    default:
      return;
  }
}

/** The slice of run state the debuff predicates read (kept structural to avoid a run.ts cycle). */
export interface BossDebuffState {
  currentBossEffect: string | null;
  /** Face codes played earlier this ante (The Pillar). */
  facesPlayedThisAnte?: string[];
  /** Set when a joker is sold this blind (Verdant Leaf's release condition). */
  jokerSoldThisBlind?: boolean;
}

/**
 * Is this card debuffed by the active boss effect? Debuffed cards still shape the poker hand
 * but contribute no chips and trigger no enhancements/editions/seals/jokers (see scoring.ts).
 */
export function isCardDebuffed(card: Card, state: BossDebuffState): boolean {
  const effect = bossEffectOf(state.currentBossEffect);
  if (!effect) return false;
  switch (effect.kind) {
    case "debuff_suit":
      return card.suit === effect.suit;
    case "debuff_face":
      return card.rank >= 11 && card.rank <= 13;
    case "debuff_played_this_ante":
      // Tracked by face code (per-instance ids regenerate across shuffles) — duplicate faces
      // over-debuff slightly; accepted prealpha simplification, mirrors deckEnhancements keying.
      return (state.facesPlayedThisAnte ?? []).includes(faceCode(card));
    case "debuff_all_until_joker_sold":
      return !state.jokerSoldThisBlind;
    default:
      return false;
  }
}

/**
 * Return `cards` with `debuffed: true` stamped on those the active boss debuffs.
 * Fast-paths to the ORIGINAL array (same refs) when no debuff-capable boss is active, so
 * toRunDTO stays allocation-free on the common path and the round-trip property holds.
 */
export function decorateDebuffs(state: BossDebuffState, cards: Card[]): Card[] {
  const effect = bossEffectOf(state.currentBossEffect);
  if (
    !effect ||
    (effect.kind !== "debuff_suit" &&
      effect.kind !== "debuff_face" &&
      effect.kind !== "debuff_played_this_ante" &&
      effect.kind !== "debuff_all_until_joker_sold")
  ) {
    return cards;
  }
  return cards.map((c) => (isCardDebuffed(c, state) ? { ...c, debuffed: true } : c));
}
