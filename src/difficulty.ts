/** Difficulty type + shared per-blind constants. Per-difficulty tuning lives in engine/ante.ts. */

export type Difficulty = "easy" | "medium" | "hard";

/** Cards dealt to the player's hand each blind, and the max selectable to play at once. */
export const HAND_SIZE = 8;
export const MAX_SELECT = 5;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}
