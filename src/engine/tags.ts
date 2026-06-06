/**
 * Tags catalog — Balatro's skip-blind reward tokens (and other trigger-based one-shots).
 * PURE DATA. Content stream PET-83 populates TAGS.
 *
 * applyTags in run.ts iterates run.tags and fires the ones whose trigger matches the phase.
 */

export type TagTrigger =
  | "on_shop_enter"
  | "on_pack_open"
  | "immediate"
  | "on_next_blind_start"
  | "on_blind_skip";

export type TagEffect =
  | { kind: "money_add"; n: number }
  | { kind: "free_pack"; packKind: string }
  | { kind: "mult_add_next_hand"; n: number }
  | { kind: "free_voucher" }
  | { kind: "extra_joker_now"; rarity: "common" | "uncommon" | "rare" };

export interface TagDef {
  id: string;
  name: string;
  description: string;
  trigger: TagTrigger;
  effect: TagEffect;
}

export const TAGS: TagDef[] = [];

export const TAG_BY_ID = new Map<string, TagDef>(TAGS.map((t) => [t.id, t]));
