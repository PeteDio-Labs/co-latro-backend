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
  /**
   * Per-joker edition overlay (PET-67). foil +50 chips, holo +10 mult, poly ×1.5 mult;
   * negative is slot-only (no scoring effect, handled by effectiveMaxJokers).
   */
  jokerEditions?: Record<string, "foil" | "holo" | "poly" | "negative">;
  /** Cards still HELD in hand (not played) — steel enhancement reads this for x1.5 per steel held. */
  handHeld?: Card[];
  /** Transient flat mult bonus consumed by the next scored hand (PET-78 mult_add_next_hand tag). */
  nextHandMultBonus?: number;
  /** The Flint (PET-239): halve the level-adjusted base chips AND base mult (ceil, so a level-1
   *  high card still scores). Set by run.ts when the active boss is halve_base_target_bonus. */
  halveBase?: boolean;
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
  // PET-75: stones don't contribute to shape detection; wilds count as any suit for flush.
  const nonStone = played.filter((c) => c.enhancement !== "stone");
  const nonStoneNonWild = nonStone.filter((c) => c.enhancement !== "wild");

  const counts = new Map<number, number>();
  for (const c of nonStone) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const countVals = [...counts.values()];
  const maxCount = countVals.length ? Math.max(...countVals) : 0;
  const pairRanks = countVals.filter((n) => n >= 2).length;

  const flush =
    played.length === 5 &&
    nonStone.length === 5 &&
    new Set(nonStoneNonWild.map((c) => c.suit)).size <= 1;

  let straight = false;
  if (played.length === 5 && nonStone.length === 5 && counts.size === 5) {
    const ranks = nonStone.map((c) => c.rank).sort((a, b) => a - b);
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
  // PET-83: face-down cards (boss effects The Wheel / The Mark) contribute nothing — no chips,
  // no edition / seal / enhancement effects, no joker triggers. If EVERY played card is
  // face-down, return a high_card scored at 0 so the play still resolves.
  const visible = played.filter((c) => !c.faceDown);
  if (visible.length === 0) {
    return {
      handType: "high_card",
      handLabel: HAND_LABEL.high_card,
      handLevel: ctx?.handLevels.high_card ?? 1,
      baseChips: 0,
      baseMult: 0,
      scoringCardIds: [],
      scoringChips: 0,
      totalChips: 0,
      score: 0,
      jokerSteps: [],
    };
  }

  const { handType, scoringCardIds } = evaluateHand(visible);
  const level = ctx?.handLevels[handType] ?? 1;
  const base = BASE_VALUES[handType];
  const per = PER_LEVEL[handType];
  let baseChips = base.chips + (level - 1) * per.chips;
  let baseMult = base.mult + (level - 1) * per.mult;
  // The Flint (PET-239): halve the level-adjusted base values. Ceil keeps a level-1 high card
  // scoring (mult 1 → 1, not 0) — documented simplification of Balatro's ×0.5.
  if (ctx?.halveBase) {
    baseChips = Math.ceil(baseChips / 2);
    baseMult = Math.ceil(baseMult / 2);
  }

  // Retrigger pre-pass: count owned jokers with retrigger_face so face cards score chips
  // (1 + retriggerCount) times. Affects the scoring-card chip loop ONLY; the joker fold
  // still adds an animation step for each retrigger joker but no chip delta there.
  const jokerIds = ctx?.jokers ?? [];
  let retriggerFaceCount = 0;
  for (const jid of jokerIds) {
    const def = JOKER_BY_ID.get(jid);
    if (def?.effect.kind === "retrigger_face") retriggerFaceCount += 1;
  }

  const cardById = new Map(visible.map((c) => [c.id, c]));
  let scoringChips = 0;
  const scoredCards: Card[] = [];
  for (const id of scoringCardIds) {
    const card = cardById.get(id);
    if (card) {
      // Debuffed cards (PET-239): they shaped the hand (evaluateHand saw them) but contribute
      // NOTHING — no rank chips, and by staying out of scoredCards they skip the modifier
      // pre-pass and every per-card joker count below.
      if (card.debuffed) continue;
      // Stone cards (PET-75): rank-less; +50 chips comes from the enhancement pre-pass, not chipValue.
      // Face cards retriggered by PET-74's retrigger_face jokers score N+1 times.
      if (card.enhancement !== "stone") {
        const isFace = card.rank >= 11 && card.rank <= 13;
        const mult = isFace ? 1 + retriggerFaceCount : 1;
        scoringChips += chipValue(card.rank) * mult;
      }
      scoredCards.push(card);
    }
  }

  // ---- per-card modifier pre-pass (PET-75) -----------------------------------------------
  // Enhancements/editions/seals contribute to chips/mult/xMult BEFORE the joker fold so
  // jokers still multiply on top. Glass × multipliers compound multiplicatively as 2^N
  // (N = glass cards scored); poly editions compound as 1.5^M.
  let modChips = 0;
  let modMult = 0;
  let modXMult = 1;
  for (const card of scoredCards) {
    if (card.enhancement) {
      switch (card.enhancement) {
        case "bonus":
          modChips += 30;
          break;
        case "mult":
          modMult += 4;
          break;
        case "wild":
          // No scoring effect; wild only changes suit detection in the evaluator.
          break;
        case "glass":
          modXMult *= 2;
          // Glass-break (1-in-4 destroy on play) is rolled in run.ts:playHand after scoring.
          break;
        case "steel":
          // Steel only scores when HELD in hand, not when played. No-op here.
          break;
        case "stone":
          modChips += 50;
          break;
        case "gold":
          // Gold pays $3 at end-of-blind if HELD; the held-gold check fires in run.ts.
          break;
        case "lucky": {
          // Deterministic simplification of Balatro RNG:
          //   real: 1/5 chance of +20 mult, 1/15 chance of +$20 per lucky scored.
          //   here: +4 mult per lucky (EV of 20 × 1/5). Money EV is granted in run.ts
          //   on play resolution at +$1 per lucky scored (EV of 20 × 1/15 ≈ 1.33, rounded down to $1).
          modMult += 4;
          break;
        }
      }
    }
    if (card.edition) {
      switch (card.edition) {
        case "foil":
          modChips += 50;
          break;
        case "holo":
          modMult += 10;
          break;
        case "poly":
          modXMult *= 1.5;
          break;
        case "negative":
          // Negative editions only matter on jokers per Balatro — DEFER (no-op on cards).
          break;
      }
    }
    // ---- seals ---------------------------------------------------------------------------
    // red: retriggers the card's chip contribution once. The base rank chips were added in
    // the scoring-card loop above, so double them here (1× extra). Stones have no rank chips
    // so a red seal on a stone retriggers the stone's +50 instead.
    if (card.seal === "red") {
      if (card.enhancement === "stone") {
        modChips += 50;
      } else {
        modChips += chipValue(card.rank);
      }
    }
    // blue / gold / purple seals are end-of-blind / on-play / on-discard effects and do not
    // affect the scoring fold — they're handled in run.ts:
    //   - blue:   levelUpHand on the last-scored hand type, fires in checkTransition
    //   - gold:   +$3 if scored, fires in playHand right after the scoring fold
    //   - purple: spawn a random Tarot, fires in discardCards
  }

  // Steel cards HELD in hand (not played) — each multiplies the running mult by ×1.5.
  // Apply AFTER the joker fold (Balatro's order), so track count now and fold in below.
  let steelHeldCount = 0;
  if (ctx?.handHeld) {
    // Use the full `played` set (including face-down) so a face-down steel card in the play
    // selection is still considered "played" and excluded from the held bonus.
    const playedIds = new Set(played.map((c) => c.id));
    for (const c of ctx.handHeld) {
      // Debuffed steel (PET-239 — e.g. Verdant Leaf debuffs held cards too) doesn't trigger.
      if (c.enhancement === "steel" && !c.debuffed && !playedIds.has(c.id)) steelHeldCount += 1;
    }
  }

  // Fold jokers left-to-right onto the running totals. Order matters: ×Mult applies to the
  // mult that exists at that joker's slot, so a ×Mult after +Mult scores higher.
  let chips = baseChips + scoringChips + modChips;
  let mult = (baseMult + modMult) * modXMult;
  // PET-78 mult_add_next_hand tag: transient flat mult bonus, applied BEFORE jokers so
  // their ×mult still multiplies it. One-shot consumption is handled by the caller.
  mult += ctx?.nextHandMultBonus ?? 0;
  const jokerSteps: JokerStep[] = [];
  if (jokerIds.length > 0) {
    const features = handFeatures(visible);
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
        case "per_suit_chips":
          chips += scoredCards.filter((c) => c.suit === e.suit).length * e.chips;
          break;
        case "contains_mult":
          if (features[e.feature]) mult += e.mult;
          break;
        case "contains_chips":
          if (features[e.feature]) chips += e.chips;
          break;
        case "hand_size_mult":
          if (visible.length <= e.maxCards) mult += e.mult;
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
      // Per-joker edition contribution applied AFTER the joker's own contribution, as a distinct
      // animation step. negative is slot-only (no scoring effect), so it's not pushed here.
      const edition = ctx?.jokerEditions?.[jid];
      if (edition) {
        const edBeforeChips = chips;
        const edBeforeMult = mult;
        switch (edition) {
          case "foil":
            chips += 50;
            break;
          case "holo":
            mult += 10;
            break;
          case "poly":
            mult *= 1.5;
            break;
          case "negative":
            // Slot bonus only — no scoring effect.
            break;
        }
        if (edition === "poly") {
          if (mult !== edBeforeMult) {
            jokerSteps.push({ jokerId: jid, name: `${def.name} [poly]`, xMult: 1.5 });
          }
        } else if (edition === "foil" || edition === "holo") {
          const dChips = chips - edBeforeChips;
          const dMult = mult - edBeforeMult;
          if (dChips !== 0 || dMult !== 0) {
            jokerSteps.push({
              jokerId: jid,
              name: `${def.name} [${edition}]`,
              ...(dChips !== 0 ? { deltaChips: dChips } : {}),
              ...(dMult !== 0 ? { deltaMult: dMult } : {}),
            });
          }
        }
      }
    }
  }

  // Steel HELD: each steel card still in hand (not scored) multiplies mult by 1.5×, applied
  // AFTER jokers so the steel bonus stacks on top of the joker fold (matches Balatro order).
  if (steelHeldCount > 0) {
    mult *= Math.pow(1.5, steelHeldCount);
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
