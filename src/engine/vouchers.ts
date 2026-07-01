import { Glob } from "bun";
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
// Catalog assembled from ./vouchers/*.ts — ONE FILE PER ENTRY (PET-216). Additive entries are
// new files, never a shared-array edit, so additive PRs cannot merge-conflict. Sorted by id.
const _vouchersDir = new URL("./vouchers/", import.meta.url).pathname;
const _vouchersFiles = [...new Glob("*.ts").scanSync({ cwd: _vouchersDir, absolute: true })]
  .filter((f) => !(f.split("/").pop() ?? "").startsWith("_"))
  .sort();
export const VOUCHERS: VoucherDef[] = _vouchersFiles.map((f) => require(f).default as VoucherDef);

export const VOUCHER_BY_ID = new Map<string, VoucherDef>(VOUCHERS.map((v) => [v.id, v]));
