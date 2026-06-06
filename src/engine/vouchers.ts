/**
 * Vouchers catalog — permanent run-wide upgrades. PURE DATA.
 *
 * Effects are a closed discriminated union here because vouchers compose deterministically
 * into the effective-* helpers (engine/effectives.ts). Content stream PET-76 populates VOUCHERS.
 */

export type VoucherEffect =
  | { kind: "extra_consumable_slot" }
  | { kind: "extra_joker_slot" }
  | { kind: "extra_hand"; n: number }
  | { kind: "extra_discard"; n: number }
  | { kind: "shop_discount_pct"; pct: number }
  | { kind: "reroll_discount"; amt: number }
  | { kind: "interest_cap_increase"; extra: number }
  | { kind: "extra_hand_size"; n: number };

export interface VoucherDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: VoucherEffect;
  /** id of a prerequisite voucher (Balatro's tier-2 upgrades). */
  requires?: string;
}

export const VOUCHERS: VoucherDef[] = [];

export const VOUCHER_BY_ID = new Map<string, VoucherDef>(VOUCHERS.map((v) => [v.id, v]));
