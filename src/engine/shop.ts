/** Shop engine: Planet cards (level up hands) + Jokers, plus reroll. Mutates RunState. */

import { shuffle } from "../cards.ts";
import { PER_LEVEL, type HandType } from "../scoring.ts";
import { GameError } from "./errors.ts";
import { JOKERS, MAX_JOKERS, type JokerDef, type JokerRarity } from "./jokers.ts";
import type { RunState } from "./run.ts";

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

export type ShopItem = PlanetShopItem | JokerShopItem;

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
}

function makePlanetItem(p: PlanetDef, levels: RunState["handLevels"]): PlanetShopItem {
  const per = PER_LEVEL[p.hand];
  const current = levels[p.hand] ?? 1;
  return {
    id: `planet:${p.id}`,
    kind: "planet",
    planet: p.id,
    hand: p.hand,
    name: p.name,
    cost: PLANET_COST,
    addChips: per.chips,
    addMult: per.mult,
    targetLevel: current + 1,
  };
}

function makeJokerItem(def: JokerDef): JokerShopItem {
  return {
    id: `joker:${def.id}`,
    kind: "joker",
    jokerId: def.id,
    name: def.name,
    description: def.description,
    cost: def.cost,
    rarity: def.rarity,
  };
}

/** Offer SHOP_ITEM_COUNT items, each rolled joker-or-planet; distinct, jokers exclude owned. */
export function generateShop(run: RunState, rng: () => number = Math.random): ShopState {
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
      items.push(makeJokerItem(jokerPool[ji++]!));
    } else if (pi < planetPool.length) {
      items.push(makePlanetItem(planetPool[pi++]!, run.handLevels));
    } else if (ji < jokerPool.length) {
      items.push(makeJokerItem(jokerPool[ji++]!));
    }
  }
  return { items, rerollCost: REROLL_BASE_COST };
}

export function buyItem(run: RunState, itemId: unknown): void {
  if (run.status !== "shop" || !run.shop) throw new GameError(409, "bad_state", "Not at the shop");
  if (typeof itemId !== "string") throw new GameError(400, "invalid_item", "item id must be a string");
  const idx = run.shop.items.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new GameError(404, "item_not_found", "Item not available");
  const item = run.shop.items[idx]!;

  // Check joker slots BEFORE charging, so a full-slots buy doesn't take money.
  if (item.kind === "joker" && run.jokers.length >= MAX_JOKERS) {
    throw new GameError(400, "slots_full", "Joker slots are full — sell one first");
  }
  if (run.money < item.cost) throw new GameError(400, "cant_afford", "Not enough money");

  run.money -= item.cost;
  if (item.kind === "planet") levelUpHand(run, item.hand);
  else run.jokers.push(item.jokerId);
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
