/**
 * Tags catalog — Balatro's skip-blind reward tokens (and other trigger-based one-shots).
 * PURE DATA. PET-78 populates the initial set; some effects (free_pack/free_voucher)
 * are deferred markers until PET-70 wires packs.
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

export const TAGS: TagDef[] = [
  {
    id: "investment_tag",
    name: "Investment Tag",
    description: "After defeating the next Boss Blind, gain $25",
    trigger: "on_shop_enter",
    effect: { kind: "money_add", n: 25 },
  },
  {
    id: "voucher_tag",
    name: "Voucher Tag",
    description: "Adds a Voucher to the next shop",
    trigger: "on_shop_enter",
    effect: { kind: "free_voucher" },
  },
  {
    id: "standard_tag",
    name: "Standard Tag",
    description: "Gives a free Mega Standard Pack",
    trigger: "on_pack_open",
    effect: { kind: "free_pack", packKind: "standard" },
  },
  {
    id: "charm_tag",
    name: "Charm Tag",
    description: "Gives a free Mega Arcana Pack",
    trigger: "on_pack_open",
    effect: { kind: "free_pack", packKind: "arcana" },
  },
  {
    id: "meteor_tag",
    name: "Meteor Tag",
    description: "Gives a free Mega Celestial Pack",
    trigger: "on_pack_open",
    effect: { kind: "free_pack", packKind: "celestial" },
  },
  {
    id: "buffoon_tag",
    name: "Buffoon Tag",
    description: "Gives a free Mega Buffoon Pack",
    trigger: "on_pack_open",
    effect: { kind: "free_pack", packKind: "buffoon" },
  },
  {
    id: "top_up_tag",
    name: "Top-up Tag",
    description: "Create up to 2 Common Jokers (must have room)",
    trigger: "immediate",
    effect: { kind: "extra_joker_now", rarity: "common" },
  },
  {
    id: "speed_tag",
    name: "Speed Tag",
    description: "Gives $5 per Blind skipped this run",
    trigger: "on_shop_enter",
    effect: { kind: "money_add", n: 5 },
  },
  {
    id: "uncommon_tag",
    name: "Uncommon Tag",
    description: "Shop has a free Uncommon Joker",
    trigger: "on_shop_enter",
    effect: { kind: "extra_joker_now", rarity: "uncommon" },
  },
  {
    id: "rare_tag",
    name: "Rare Tag",
    description: "Shop has a free Rare Joker",
    trigger: "on_shop_enter",
    effect: { kind: "extra_joker_now", rarity: "rare" },
  },
];

export const TAG_BY_ID = new Map<string, TagDef>(TAGS.map((t) => [t.id, t]));
