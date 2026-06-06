/**
 * Balatro scoring: score = (base + Σ scoring-card chips, all hand-level adjusted) × base mult,
 * then jokers fold in left-to-right (order matters: ×Mult applies after +Mult).
 * Shared by the play path and the non-mutating preview path so they can never drift.
 */

import { chipValue, type Card } from "./cards.ts";
import { evaluateHand, type HandType } from "./evaluator.ts";
import { JOKERS } from "./engine/jokers.ts";

export type { HandType } from "./evaluator.ts";

const JOKER_BY_ID = new Map(JOKERS.map((j) => [j.id, j]));

export interface HandBaseValue {
  chips: number;
  mult: number;
}

export const BASE_VALUES: Record<HandType, HandBaseValue> = {
  high_card: { chips: 5, mult: 1 },
  pair: { chips: 10, mult: 2 },
  two_pair: { chips: 20, mult: 2 },
  three_of_a_kind: { chips: 30, mult: 3 },
  straight: { chips: 30, mult: 4 },
  flush: { chips: 35, mult: 4 },
  full_house: { chips: 40, mult: 4 },
  four_of_a_kind: { chips: 60, mult: 7 },
  straight_flush: { chips: 100, mult: 8 },
  royal_flush: { chips: 100, mult: 8 }, // label only; identical score to straight flush
  five_of_a_kind: { chips: 50, mult: 12 }, // Planet X (secret hand — needs Wilds in practice)
  flush_house: { chips: 40, mult: 14 }, // Ceres
  flush_five: { chips: 160, mult: 16 }, // Eris
};

export const HAND_LABEL: Record<HandType, string> = {
  high_card: "High Card",
  pair: "Pair",
  two_pair: "Two Pair",
  three_of_a_kind: "Three of a Kind",
  straight: "Straight",
  flush: "Flush",
  full_house: "Full House",
  four_of_a_kind: "Four of a Kind",
  straight_flush: "Straight Flush",
  royal_flush: "Royal Flush",
  five_of_a_kind: "Five of a Kind",
  flush_house: "Flush House",
  flush_five: "Flush Five",
};

/** Per-level increments (Balatro planet cards). Level 1 = BASE_VALUES; each further level adds this. */
export const PER_LEVEL: Record<HandType, HandBaseValue> = {
  high_card: { chips: 10, mult: 1 }, // Pluto
  pair: { chips: 15, mult: 1 }, // Mercury
  two_pair: { chips: 20, mult: 1 }, // Uranus
  three_of_a_kind: { chips: 20, mult: 2 }, // Venus
  straight: { chips: 30, mult: 3 }, // Saturn
  flush: { chips: 15, mult: 2 }, // Jupiter
  full_house: { chips: 25, mult: 2 }, // Earth
  four_of_a_kind: { chips: 30, mult: 3 }, // Mars
  straight_flush: { chips: 40, mult: 4 }, // Neptune
  royal_flush: { chips: 40, mult: 4 }, // Neptune (shared level with straight flush)
  five_of_a_kind: { chips: 35, mult: 4 }, // Planet X
  flush_house: { chips: 40, mult: 4 }, // Ceres
  flush_five: { chips: 50, mult: 3 }, // Eris
};

/** Per-run poker-hand levels (1-based). */
export type HandLevels = Record<HandType, number>;

export function defaultHandLevels(): HandLevels {
  const out = {} as HandLevels;
  for (const hand of Object.keys(BASE_VALUES) as HandType[]) out[hand] = 1;
  return out;
}

/** Run context for scoring. */
export interface ScoreContext {
  handLevels: HandLevels;
  jokers?: string[];
  handsRemaining?: number;
  discardsRemaining?: number;
  /** Per-blind discard count (drives on_discard_chips). */
  discardsUsedThisBlind?: number;
  /** Current money (drives per_5_dollars_mult). */
  money?: number;
  /** Per-joker counter state (drives scaling_per_blind_*). */
  jokerStates?: Record<string, { counter: number }>;
}

/** One joker's contribution during scoring — drives the play-resolution animation. */
export interface JokerStep {
  jokerId: string;
  name: string;
  deltaChips?: number;
  deltaMult?: number;
  xMult?: number;
}

/** "Contains" features of the played cards (subset matching, broader than the single best hand type). */
export interface HandFeatures {
  pair: boolean;
  two_pair: boolean;
  three_of_a_kind: boolean;
  straight: boolean;
  flush: boolean;
}

export function handFeatures(played: Card[]): HandFeatures {
  const counts = new Map<number, number>();
  for (const c of played) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const countVals = [...counts.values()];
  const maxCount = countVals.length ? Math.max(...countVals) : 0;
  const pairRanks = countVals.filter((n) => n >= 2).length;

  const flush = played.length === 5 && new Set(played.map((c) => c.suit)).size === 1;

  let straight = false;
  if (played.length === 5 && counts.size === 5) {
    const ranks = played.map((c) => c.rank).sort((a, b) => a - b);
    const min = ranks[0]!;
    const max = ranks[4]!;
    const isWheel =
      ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14;
    straight = max - min === 4 || isWheel;
  }

  return {
    pair: maxCount >= 2,
    two_pair: pairRanks >= 2,
    three_of_a_kind: maxCount >= 3,
    straight,
    flush,
  };
}

export interface ScoreBreakdown {
  handType: HandType;
  handLabel: string;
  handLevel: number;
  baseChips: number; // effective (level-adjusted) base chips
  baseMult: number; // effective (level-adjusted) base mult
  scoringCardIds: string[];
  scoringChips: number;
  totalChips: number; // chips after jokers, before × mult
  score: number;
  jokerSteps: JokerStep[];
}

export function scoreHand(played: Card[], ctx?: ScoreContext): ScoreBreakdown {
  const { handType, scoringCardIds } = evaluateHand(played);
  const level = ctx?.handLevels[handType] ?? 1;
  const base = BASE_VALUES[handType];
  const per = PER_LEVEL[handType];
  const baseChips = base.chips + (level - 1) * per.chips;
  const baseMult = base.mult + (level - 1) * per.mult;

  // Retrigger pre-pass: count owned jokers with retrigger_face so face cards score chips
  // (1 + retriggerCount) times. Affects the scoring-card chip loop ONLY; the joker fold
  // still adds an animation step for each retrigger joker but no chip delta there.
  const jokerIds = ctx?.jokers ?? [];
  let retriggerFaceCount = 0;
  for (const jid of jokerIds) {
    const def = JOKER_BY_ID.get(jid);
    if (def?.effect.kind === "retrigger_face") retriggerFaceCount += 1;
  }

  const cardById = new Map(played.map((c) => [c.id, c]));
  let scoringChips = 0;
  const scoredCards: Card[] = [];
  for (const id of scoringCardIds) {
    const card = cardById.get(id);
    if (card) {
      const isFace = card.rank >= 11 && card.rank <= 13;
      const mult = isFace ? 1 + retriggerFaceCount : 1;
      scoringChips += chipValue(card.rank) * mult;
      scoredCards.push(card);
    }
  }

  // Per-card modifier pre-pass (PET-67 hook). Enhancements/editions/seals contribute to
  // chips/mult/xMult BEFORE the joker fold. With no card carrying any of these — current
  // default — this loop is a no-op. Content stream PET-75 expands each switch arm.
  let modChips = 0;
  let modMult = 0;
  let modXMult = 1;
  for (const card of scoredCards) {
    if (card.enhancement) {
      switch (card.enhancement) {
        case "bonus":
        case "mult":
        case "wild":
        case "glass":
        case "steel":
        case "stone":
        case "gold":
        case "lucky":
          // PET-75 wires per-enhancement contributions here.
          break;
      }
    }
    if (card.edition) {
      switch (card.edition) {
        case "foil":
        case "holo":
        case "poly":
        case "negative":
          // PET-75 wires per-edition contributions here.
          break;
      }
    }
    // Seals (red/blue/gold/purple) act on the run, not on chips/mult — wired in run.ts hooks
    // when content streams populate them. No-op here.
  }

  // Fold jokers left-to-right onto the running totals. Order matters: ×Mult applies to the
  // mult that exists at that joker's slot, so a ×Mult after +Mult scores higher.
  let chips = baseChips + scoringChips + modChips;
  let mult = (baseMult + modMult) * modXMult;
  const jokerSteps: JokerStep[] = [];
  if (jokerIds.length > 0) {
    const features = handFeatures(played);
    for (const jid of jokerIds) {
      const def = JOKER_BY_ID.get(jid);
      if (!def) continue;
      const beforeChips = chips;
      const beforeMult = mult;
      const e = def.effect;
      switch (e.kind) {
        case "flat_mult":
          mult += e.mult;
          break;
        case "flat_chips":
          chips += e.chips;
          break;
        case "per_suit_mult":
          mult += scoredCards.filter((c) => c.suit === e.suit).length * e.mult;
          break;
        case "contains_mult":
          if (features[e.feature]) mult += e.mult;
          break;
        case "contains_chips":
          if (features[e.feature]) chips += e.chips;
          break;
        case "hand_size_mult":
          if (played.length <= e.maxCards) mult += e.mult;
          break;
        case "per_face_chips":
          chips += scoredCards.filter((c) => c.rank >= 11 && c.rank <= 13).length * e.chips;
          break;
        case "per_parity_mult": {
          const wantEven = e.parity === "even";
          mult += scoredCards.filter((c) => (c.rank % 2 === 0) === wantEven).length * e.mult;
          break;
        }
        case "per_parity_chips": {
          const wantEven = e.parity === "even";
          chips += scoredCards.filter((c) => (c.rank % 2 === 0) === wantEven).length * e.chips;
          break;
        }
        case "per_joker_mult":
          mult += jokerIds.length * e.mult;
          break;
        case "per_remaining_discard_chips":
          chips += (ctx?.discardsRemaining ?? 0) * e.chips;
          break;
        case "x_mult_contains":
          if (features[e.feature]) mult *= e.xMult;
          break;
        case "retrigger_face":
          // Chip impact already applied in the scoring-card pre-pass; no fold delta here.
          break;
        case "scaling_per_blind_mult": {
          const counter = ctx?.jokerStates?.[jid]?.counter ?? 0;
          mult += counter * e.mult;
          break;
        }
        case "scaling_per_blind_chips": {
          const counter = ctx?.jokerStates?.[jid]?.counter ?? 0;
          chips += counter * e.chips;
          break;
        }
        case "economy_per_hand_played":
          // Money payout happens in run.ts after scoring; no chip/mult delta here.
          break;
        case "on_discard_chips":
          chips += (ctx?.discardsUsedThisBlind ?? 0) * e.chips;
          break;
        case "flat_chips_and_mult":
          chips += e.chips;
          mult += e.mult;
          break;
        case "per_5_dollars_mult":
          mult += Math.floor((ctx?.money ?? 0) / 5) * e.mult;
          break;
      }
      if (e.kind === "x_mult_contains") {
        if (mult !== beforeMult) jokerSteps.push({ jokerId: jid, name: def.name, xMult: e.xMult });
      } else if (e.kind === "retrigger_face") {
        // Always log an animation step when this joker is owned and there were face cards scored.
        if (scoredCards.some((c) => c.rank >= 11 && c.rank <= 13)) {
          jokerSteps.push({ jokerId: jid, name: def.name });
        }
      } else {
        const dChips = chips - beforeChips;
        const dMult = mult - beforeMult;
        if (dChips !== 0 || dMult !== 0) {
          jokerSteps.push({
            jokerId: jid,
            name: def.name,
            ...(dChips !== 0 ? { deltaChips: dChips } : {}),
            ...(dMult !== 0 ? { deltaMult: dMult } : {}),
          });
        }
      }
    }
  }

  return {
    handType,
    handLabel: HAND_LABEL[handType],
    handLevel: level,
    baseChips,
    baseMult,
    scoringCardIds,
    scoringChips,
    totalChips: chips,
    score: Math.round(chips * mult),
    jokerSteps,
  };
}
