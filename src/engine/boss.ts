/**
 * Boss-blind effects catalog. PURE DATA. PET-83 populates BOSS_EFFECTS with the first slice.
 *
 * rollBossEffect is called from startBlind when blindKind === "boss". With an empty catalog
 * this returns null, so boss blinds would run with no extra effect.
 *
 * Mechanically-wired effects (in run.ts):
 *   - the_needle: handsRemaining clamped to 1 at blind start.
 *   - the_wall:   target multiplier +50% (1.5×) via effectiveBossTargetMult.
 *   - the_hook:   removes 2 random cards from hand after each played hand.
 *   - the_wheel:  1-in-7 chance per dealt card → flipped face-down (applied on deal + redraw).
 *   - the_mark:   every face card (J/Q/K, rank 11-13) dealt is flipped face-down.
 *
 * Face-down cards are filtered out of the evaluator + scoring fold (see scoring.ts). The card
 * is "revealed" (faceDown → false) on the way out as part of the played hand so the play
 * animation can show its real rank/suit.
 */

import type { Card } from "../cards.ts";

export interface BossEffectDef {
  id: string;
  name: string;
  description: string;
  /** Multiplier applied on top of the boss blind's base target (default 1 = no change). */
  targetMult?: number;
}

export const BOSS_EFFECTS: BossEffectDef[] = [
  {
    id: "the_needle",
    name: "The Needle",
    description: "Play only 1 hand.",
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
  },
  {
    id: "the_wheel",
    name: "The Wheel",
    description: "1 in 7 cards drawn face-down.",
  },
  {
    id: "the_mark",
    name: "The Mark",
    description: "All face cards start face-down.",
  },
];

export const BOSS_EFFECT_BY_ID = new Map<string, BossEffectDef>(
  BOSS_EFFECTS.map((b) => [b.id, b]),
);

/** Pick a boss effect uniformly. With an empty catalog returns null (safety net). */
export function rollBossEffect(_ante: number, rng: () => number): string | null {
  if (BOSS_EFFECTS.length === 0) return null;
  const idx = Math.floor(rng() * BOSS_EFFECTS.length);
  return BOSS_EFFECTS[idx]?.id ?? null;
}

/** Extra target multiplier from the active boss effect (default 1 when none / no targetMult). */
export function effectiveBossTargetMult(currentBossEffect: string | null): number {
  if (!currentBossEffect) return 1;
  const def = BOSS_EFFECT_BY_ID.get(currentBossEffect);
  return def?.targetMult ?? 1;
}

/**
 * Mutate `cards` in place, flipping `faceDown = true` on those affected by the active boss effect:
 *   - the_wheel: each card has a 1-in-7 chance (rng() < 1/7).
 *   - the_mark:  every face card (rank 11-13).
 * All other boss effects (or none) are no-ops. Cards already face-down are left untouched so
 * a redraw doesn't accidentally re-reveal them.
 */
export function applyFaceDownEffect(
  cards: Card[],
  currentBossEffect: string | null,
  rng: () => number,
): void {
  if (!currentBossEffect) return;
  if (currentBossEffect === "the_wheel") {
    for (const c of cards) {
      if (c.faceDown) continue;
      if (rng() < 1 / 7) c.faceDown = true;
    }
    return;
  }
  if (currentBossEffect === "the_mark") {
    for (const c of cards) {
      if (c.faceDown) continue;
      if (c.rank >= 11 && c.rank <= 13) c.faceDown = true;
    }
    return;
  }
}
