/** Shop engine: Planet cards (level up hands) + Jokers, plus reroll. Mutates RunState. */

import { shuffle } from "../cards.ts";
import { PER_LEVEL, type HandType } from "../scoring.ts";
import { GameError } from "./errors.ts";
import { JOKERS, isScalingEffect, type JokerDef, type JokerRarity } from "./jokers.ts";
import type { RunState } from "./run.ts";
import { CONSUMABLES, type ConsumableDef } from "./consumables.ts";
import { VOUCHERS, type VoucherDef } from "./vouchers.ts";
import {
  applyShopDiscount,
  effectiveMaxConsumables,
  effectiveMaxJokers,
  effectiveRerollDiscount,
  effectiveShopDiscountPct,
} from "./effectives.ts";

export type PlanetId =
  | "pluto" | "mercury" | "uranus" | "venus" | "saturn"
  | "jupiter" | "earth" | "mars" | "neptune"
  | "planet_x" | "ceres" | "eris";

export interface PlanetDef {
  id: PlanetId;
  name: string;
  hand: HandType;
}

export const PLANETS: PlanetDef[] = [
  { id: "pluto", name: "Pluto", hand: "high_card" },
  { id: "mercury", name: "Mercury", hand: "pair" },
  { id: "uranus", name: "Uranus", hand: "two_pair" },
  { id: "venus", name: "Venus", hand: "three_of_a_kind" },
  { id: "saturn", name: "Saturn", hand: "straight" },
  { id: "jupiter", name: "Jupiter", hand: "flush" },
  { id: "earth", name: "Earth", hand: "full_house" },
  { id: "mars", name: "Mars", hand: "four_of_a_kind" },
  { id: "neptune", name: "Neptune", hand: "straight_flush" }, // also levels royal flush
  { id: "planet_x", name: "Planet X", hand: "five_of_a_kind" },
  { id: "ceres", name: "Ceres", hand: "flush_house" },
  { id: "eris", name: "Eris", hand: "flush_five" },
];

export const PLANET_COST = 3;
export const SHOP_ITEM_COUNT = 3;
export const REROLL_BASE_COST = 5;
export const JOKER_WEIGHT = 0.45; // chance a shop slot rolls a joker vs a planet

export interface PlanetShopItem {
  id: string; // "planet:saturn"
  kind: "planet";
  planet: PlanetId;
  hand: HandType;
  name: string;
  cost: number;
  addChips: number;
  addMult: number;
  targetLevel: number;
}

export interface JokerShopItem {
  id: string; // "joker:the_duo"
  kind: "joker";
  jokerId: string;
  name: string;
  description: string;
  cost: number;
  rarity: JokerRarity;
}

export interface ConsumableShopItem {
  id: string; // "consumable:<defId>"
  kind: "consumable";
  consumableId: string;
  name: string;
  description: string;
  cost: number;
}

export interface VoucherShopItem {
  id: string; // "voucher:<voucherId>"
  kind: "voucher";
  voucherId: string;
  name: string;
  description: string;
  cost: number;
}

export type ShopItem = PlanetShopItem | JokerShopItem | ConsumableShopItem | VoucherShopItem;

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
  /** Vouchers offer one slot per shop visit (Balatro). Null when VOUCHERS catalog is empty. */
  voucher: VoucherShopItem | null;
}

function makePlanetItem(p: PlanetDef, levels: RunState["handLevels"], discountPct: number): PlanetShopItem {
  const per = PER_LEVEL[p.hand];
  const current = levels[p.hand] ?? 1;
  return {
    id: `planet:${p.id}`,
    kind: "planet",
    planet: p.id,
    hand: p.hand,
    name: p.name,
    cost: applyShopDiscount(PLANET_COST, discountPct),
    addChips: per.chips,
    addMult: per.mult,
    targetLevel: current + 1,
  };
}

function makeJokerItem(def: JokerDef, discountPct: number): JokerShopItem {
  return {
    id: `joker:${def.id}`,
    kind: "joker",
    jokerId: def.id,
    name: def.name,
    description: def.description,
    cost: applyShopDiscount(def.cost, discountPct),
    rarity: def.rarity,
  };
}

function makeConsumableItem(def: ConsumableDef, discountPct: number): ConsumableShopItem {
  return {
    id: `consumable:${def.id}`,
    kind: "consumable",
    consumableId: def.id,
    name: def.name,
    description: def.description,
    cost: applyShopDiscount(def.cost, discountPct),
  };
}

function makeVoucherItem(def: VoucherDef, discountPct: number): VoucherShopItem {
  return {
    id: `voucher:${def.id}`,
    kind: "voucher",
    voucherId: def.id,
    name: def.name,
    description: def.description,
    cost: applyShopDiscount(def.cost, discountPct),
  };
}

/** Offer SHOP_ITEM_COUNT items, each rolled joker-or-planet; distinct, jokers exclude owned. */
export function generateShop(run: RunState, rng: () => number = Math.random): ShopState {
  const discountPct = effectiveShopDiscountPct(run);
  const planetPool = shuffle(PLANETS, rng);
  const owned = new Set(run.jokers);
  const jokerPool = shuffle(
    JOKERS.filter((j) => !owned.has(j.id)),
    rng,
  );
  const items: ShopItem[] = [];
  let pi = 0;
  let ji = 0;
  for (let slot = 0; slot < SHOP_ITEM_COUNT; slot++) {
    const rollJoker = rng() < JOKER_WEIGHT;
    if (rollJoker && ji < jokerPool.length) {
      items.push(makeJokerItem(jokerPool[ji++]!, discountPct));
    } else if (pi < planetPool.length) {
      items.push(makePlanetItem(planetPool[pi++]!, run.handLevels, discountPct));
    } else if (ji < jokerPool.length) {
      items.push(makeJokerItem(jokerPool[ji++]!, discountPct));
    }
  }
  // Voucher slot: one per shop visit, only when VOUCHERS catalog has entries.
  let voucher: VoucherShopItem | null = null;
  if (VOUCHERS.length > 0) {
    const owned = new Set(run.vouchers);
    const eligible = VOUCHERS.filter(
      (v) => !owned.has(v.id) && (!v.requires || owned.has(v.requires)),
    );
    if (eligible.length > 0) {
      const pool = shuffle(eligible, rng);
      voucher = makeVoucherItem(pool[0]!, discountPct);
    }
  }
  const rerollCost = Math.max(1, REROLL_BASE_COST - effectiveRerollDiscount(run));
  return { items, rerollCost, voucher };
}

export function buyItem(run: RunState, itemId: unknown): void {
  if (run.status !== "shop" || !run.shop) throw new GameError(409, "bad_state", "Not at the shop");
  if (typeof itemId !== "string") throw new GameError(400, "invalid_item", "item id must be a string");

  // Vouchers live in the dedicated shop.voucher slot, not shop.items.
  if (run.shop.voucher && run.shop.voucher.id === itemId) {
    const v = run.shop.voucher;
    if (run.money < v.cost) throw new GameError(400, "cant_afford", "Not enough money");
    run.money -= v.cost;
    run.vouchers.push(v.voucherId);
    run.shop.voucher = null;
    return;
  }

  const idx = run.shop.items.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new GameError(404, "item_not_found", "Item not available");
  const item = run.shop.items[idx]!;

  // Check slot caps BEFORE charging, so a full-slots buy doesn't take money.
  if (item.kind === "joker" && run.jokers.length >= effectiveMaxJokers(run)) {
    throw new GameError(400, "slots_full", "Joker slots are full — sell one first");
  }
  if (item.kind === "consumable" && run.consumables.length >= effectiveMaxConsumables(run)) {
    throw new GameError(400, "slots_full", "Consumable slots are full — sell or use one first");
  }
  if (run.money < item.cost) throw new GameError(400, "cant_afford", "Not enough money");

  run.money -= item.cost;
  if (item.kind === "planet") levelUpHand(run, item.hand);
  else if (item.kind === "joker") {
    run.jokers.push(item.jokerId);
    const def = JOKERS.find((j) => j.id === item.jokerId);
    if (def && isScalingEffect(def.effect)) {
      run.jokerStates[item.jokerId] = { counter: 0 };
    }
  } else if (item.kind === "consumable") {
    run.consumables.push({ id: crypto.randomUUID(), defId: item.consumableId });
  }
  run.shop.items.splice(idx, 1);
}

export function rerollShop(run: RunState, rng: () => number = Math.random): void {
  if (run.status !== "shop" || !run.shop) throw new GameError(409, "bad_state", "Not at the shop");
  if (run.money < run.shop.rerollCost) throw new GameError(400, "cant_afford", "Not enough money");
  run.money -= run.shop.rerollCost;
  const nextCost = run.shop.rerollCost + 1;
  run.shop = generateShop(run, rng);
  run.shop.rerollCost = nextCost;
}

/** Level a hand; Neptune levels straight_flush and royal_flush together (shared level). */
export function levelUpHand(run: RunState, hand: HandType): void {
  run.handLevels[hand] = (run.handLevels[hand] ?? 1) + 1;
  if (hand === "straight_flush") run.handLevels.royal_flush = (run.handLevels.royal_flush ?? 1) + 1;
  if (hand === "royal_flush") run.handLevels.straight_flush = (run.handLevels.straight_flush ?? 1) + 1;
}
