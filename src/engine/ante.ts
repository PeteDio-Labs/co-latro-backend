/** Ante ladder math: authentic Balatro blind targets, rewards, and difficulty tuning. PURE. */

import type { Difficulty } from "../difficulty.ts";

/** Clear the Boss of this ante to win the run (Balatro's default). */
export const MAX_ANTE = 8;

export const BLINDS = ["small", "big", "boss"] as const;
export type BlindKind = (typeof BLINDS)[number];

/** Target multiplier per blind within an ante. */
export const BLIND_MULT: Record<BlindKind, number> = { small: 1, big: 1.5, boss: 2 };

/** Base cash-out reward ($) for clearing each blind. */
export const BLIND_REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };

/** Authentic Balatro base chip requirement per ante (index 0 unused; antes 1..8). */
export const ANTE_BASE: readonly number[] = [0, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

export interface DifficultyTuning {
  label: string;
  /** Scales every blind target. */
  targetMult: number;
  /** Hands granted at the start of each blind. */
  hands: number;
  /** Discards granted at the start of each blind. */
  discards: number;
}

export const DIFFICULTY_TUNING: Record<Difficulty, DifficultyTuning> = {
  easy: { label: "Easy", targetMult: 0.6, hands: 5, discards: 4 },
  medium: { label: "Medium", targetMult: 1.0, hands: 4, discards: 3 },
  hard: { label: "Hard", targetMult: 1.4, hands: 3, discards: 2 },
};

export function blindKind(blindIndex: number): BlindKind {
  return BLINDS[blindIndex] ?? "small";
}

/** target = ANTE_BASE[ante] × blindMult × difficultyMult, rounded. */
export function blindTarget(ante: number, blindIndex: number, difficulty: Difficulty): number {
  const base = ANTE_BASE[ante] ?? 0;
  const mult = BLIND_MULT[blindKind(blindIndex)];
  return Math.round(base * mult * DIFFICULTY_TUNING[difficulty].targetMult);
}

/** Simplified Balatro cash-out: blind base reward + $1 per remaining hand (interest skipped for MVP). */
export function cashOutMoney(blindIndex: number, handsRemaining: number): number {
  return BLIND_REWARD[blindKind(blindIndex)] + Math.max(0, handsRemaining);
}
