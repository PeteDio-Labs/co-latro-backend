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

/**
 * Standardized cost of 10 per voucher (Balatro varies; flat for now).
 * Tier-2 vouchers gate behind `requires` so they only appear after their prereq is owned
 * (shop.ts filters them out otherwise).
 */
export const VOUCHERS: VoucherDef[] = [
  {
    id: "crystal_ball",
    name: "Crystal Ball",
    description: "+1 consumable slot",
    cost: 10,
    effect: { kind: "extra_consumable_slot" },
  },
  {
    id: "grabber",
    name: "Grabber",
    description: "+1 hand per blind",
    cost: 10,
    effect: { kind: "extra_hand", n: 1 },
  },
  {
    id: "wasteful",
    name: "Wasteful",
    description: "+1 discard per blind",
    cost: 10,
    effect: { kind: "extra_discard", n: 1 },
  },
  {
    id: "antimatter",
    name: "Antimatter",
    description: "+1 joker slot",
    cost: 10,
    effect: { kind: "extra_joker_slot" },
  },
  {
    id: "reroll_surplus",
    name: "Reroll Surplus",
    description: "Rerolls cost $2 less",
    cost: 10,
    effect: { kind: "reroll_discount", amt: 2 },
  },
  {
    id: "reroll_glut",
    name: "Reroll Glut",
    description: "Rerolls cost $3 less (stacks with Reroll Surplus)",
    cost: 10,
    effect: { kind: "reroll_discount", amt: 3 },
    requires: "reroll_surplus",
  },
  {
    id: "seed_money",
    name: "Seed Money",
    description: "Interest cap raised by $5",
    cost: 10,
    effect: { kind: "interest_cap_increase", extra: 5 },
  },
  {
    id: "money_tree",
    name: "Money Tree",
    description: "Interest cap raised by $10",
    cost: 10,
    effect: { kind: "interest_cap_increase", extra: 10 },
    requires: "seed_money",
  },
  {
    id: "clearance_sale",
    name: "Clearance Sale",
    description: "All shop items 25% off",
    cost: 10,
    effect: { kind: "shop_discount_pct", pct: 25 },
  },
  {
    id: "liquidation",
    name: "Liquidation",
    description: "All shop items 50% off",
    cost: 10,
    effect: { kind: "shop_discount_pct", pct: 50 },
    requires: "clearance_sale",
  },
  {
    id: "hieroglyph",
    name: "Hieroglyph",
    description: "+1 hand size",
    cost: 10,
    effect: { kind: "extra_hand_size", n: 1 },
  },
  {
    id: "fortune_scale",
    name: "Fortune Scale",
    description: "Raises the max interest earned per round by $5",
    cost: 10,
    effect: { kind: "interest_cap_increase", extra: 5 },
  },
];

export const VOUCHER_BY_ID = new Map<string, VoucherDef>(VOUCHERS.map((v) => [v.id, v]));
