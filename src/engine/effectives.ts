/**
 * Effective-* helpers — fold owned vouchers into the run-wide caps/budgets that other engine
 * modules read. With an empty VOUCHERS catalog (or no vouchers owned), every helper returns
 * the base default, so behavior is unchanged.
 *
 * Centralizing the fold here means new voucher effects (PET-76) only ever touch vouchers.ts.
 */

import { HAND_SIZE } from "../difficulty.ts";
import { DEFAULT_INTEREST_CAP } from "./ante.ts";
import { bossEffectOf } from "./boss.ts";
import { MAX_JOKERS } from "./jokers.ts";
import type { RunState } from "./run.ts";
import { VOUCHER_BY_ID, type VoucherEffect } from "./vouchers.ts";

/** Iterate the resolved VoucherEffects on a run (skips unknown ids silently). */
function* effectsOf(run: RunState): Generator<VoucherEffect> {
  for (const id of run.vouchers) {
    const def = VOUCHER_BY_ID.get(id);
    if (def) yield def.effect;
  }
}

export function effectiveMaxJokers(run: RunState): number {
  let extra = 0;
  for (const e of effectsOf(run)) if (e.kind === "extra_joker_slot") extra += 1;
  // Negative-editioned owned jokers each grant an extra slot (Balatro behavior).
  if (run.jokerEditions) {
    const owned = new Set(run.jokers);
    for (const [jid, ed] of Object.entries(run.jokerEditions)) {
      if (ed === "negative" && owned.has(jid)) extra += 1;
    }
  }
  return MAX_JOKERS + extra;
}

export function effectiveMaxConsumables(run: RunState): number {
  let extra = 0;
  for (const e of effectsOf(run)) if (e.kind === "extra_consumable_slot") extra += 1;
  return run.maxConsumables + extra;
}

export function effectiveExtraHands(run: RunState): number {
  let n = 0;
  for (const e of effectsOf(run)) if (e.kind === "extra_hand") n += e.n;
  return n;
}

export function effectiveExtraDiscards(run: RunState): number {
  let n = 0;
  for (const e of effectsOf(run)) if (e.kind === "extra_discard") n += e.n;
  return n;
}

export function effectiveInterestCap(run: RunState): number {
  let extra = 0;
  for (const e of effectsOf(run)) if (e.kind === "interest_cap_increase") extra += e.extra;
  return DEFAULT_INTEREST_CAP + extra;
}

/** Take the MAX discount across owned vouchers (they don't stack multiplicatively). */
export function effectiveShopDiscountPct(run: RunState): number {
  let best = 0;
  for (const e of effectsOf(run)) {
    if (e.kind === "shop_discount_pct" && e.pct > best) best = e.pct;
  }
  return best;
}

export function effectiveRerollDiscount(run: RunState): number {
  let n = 0;
  for (const e of effectsOf(run)) if (e.kind === "reroll_discount") n += e.amt;
  return n;
}

export function effectiveExtraHandSize(run: RunState): number {
  let n = 0;
  for (const e of effectsOf(run)) if (e.kind === "extra_hand_size") n += e.n;
  return n;
}

/**
 * Effective hand size for the run: base HAND_SIZE + voucher extras + run-long offset
 * (Ouija/Ectoplasm-style downsides land in run.handSizeOffset) + the active boss's
 * reduce_hand_size delta (The Manacle, PET-239 — blind-scoped, clears with the boss effect).
 * Floored at 1 so a stacked downside can never deadlock a blind by dealing 0 cards.
 */
export function effectiveHandSize(run: RunState): number {
  const bossEffect = bossEffectOf(run.currentBossEffect);
  const bossDelta = bossEffect?.kind === "reduce_hand_size" ? -bossEffect.n : 0;
  const total = HAND_SIZE + effectiveExtraHandSize(run) + (run.handSizeOffset ?? 0) + bossDelta;
  return Math.max(1, total);
}

/** Apply the shop discount to a raw cost, floored at 1 (free items would skip the buy path). */
export function applyShopDiscount(rawCost: number, pct: number): number {
  if (pct <= 0) return rawCost;
  return Math.max(1, Math.round(rawCost * (1 - pct / 100)));
}
