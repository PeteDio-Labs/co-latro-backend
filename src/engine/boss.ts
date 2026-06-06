/**
 * Boss-blind effects catalog. PURE DATA. Content stream PET-78 populates BOSS_EFFECTS.
 *
 * rollBossEffect is called from startBlind when blindKind === "boss". With an empty
 * catalog this returns null, so boss blinds run with no extra effect (current behavior).
 */

export interface BossEffectDef {
  id: string;
  name: string;
  description: string;
  /** Optional override of the boss-blind target multiplier (defaults to BLIND_MULT.boss = 2). */
  targetMult?: number;
}

export const BOSS_EFFECTS: BossEffectDef[] = [];

export const BOSS_EFFECT_BY_ID = new Map<string, BossEffectDef>(
  BOSS_EFFECTS.map((b) => [b.id, b]),
);

/** Pick a boss effect for the given ante. With no effects loaded, returns null. */
export function rollBossEffect(_ante: number, _rng: () => number): string | null {
  if (BOSS_EFFECTS.length === 0) return null;
  const idx = Math.floor(_rng() * BOSS_EFFECTS.length);
  return BOSS_EFFECTS[idx]?.id ?? null;
}
