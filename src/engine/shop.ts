/** Shop engine: Planet cards (level up hands) + Jokers, plus reroll. Mutates RunState. */

import {
  ALL_RANKS,
  ALL_SUITS,
  faceCode,
  shuffle,
  type CardEdition,
  type CardEnhancement,
} from "../cards.ts";
import { PER_LEVEL, type HandType } from "../scoring.ts";
import { GameError } from "./errors.ts";
import { JOKERS, type JokerDef, type JokerRarity } from "./jokers.ts";
import type { RunState } from "./run.ts";
import { CONSUMABLES, type ConsumableDef } from "./consumables.ts";
import {
  PACK_BY_ID,
  PACKS,
  type OpeningPack,
  type PackChoiceItem,
  type PackDef,
  type PackKind,
  type PackSize,
} from "./packs.ts";
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
export const JOKER_WEIGHT = 0.45; // chance a shop slot rolls a joker vs other
export const CONSUMABLE_WEIGHT = 0.2; // of the non-joker slot, chance to roll a consumable (vs planet)
export const PACK_WEIGHT = 0.1; // chance a shop slot rolls a booster pack (rolled first, before joker)

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

export interface PackShopItem {
  id: string; // "pack:<packId>"
  kind: "pack";
  packId: string;
  name: string;
  cost: number;
  size: PackSize;
  packKind: PackKind;
  /** How many of `contents` the player picks when this pack is opened. */
  choices: number;
  /** How many items are presented when this pack is opened. */
  contents: number;
}

export type ShopItem =
  | PlanetShopItem
  | JokerShopItem
  | ConsumableShopItem
  | VoucherShopItem
  | PackShopItem;

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

function makePackItem(def: PackDef, discountPct: number): PackShopItem {
  return {
    id: `pack:${def.id}`,
    kind: "pack",
    packId: def.id,
    name: def.name,
    cost: applyShopDiscount(def.cost, discountPct),
    size: def.size,
    packKind: def.kind,
    choices: def.choices,
    contents: def.contents,
  };
}

/** Offer SHOP_ITEM_COUNT items, each rolled joker-vs-planet-vs-consumable; distinct, jokers exclude owned. */
export function generateShop(run: RunState, rng: () => number = Math.random): ShopState {
  const discountPct = effectiveShopDiscountPct(run);
  const planetPool = shuffle(PLANETS, rng);
  const owned = new Set(run.jokers);
  const jokerPool = shuffle(
    JOKERS.filter((j) => !owned.has(j.id)),
    rng,
  );
  const consumablePool = shuffle(CONSUMABLES, rng);
  const packPool = shuffle(PACKS, rng);
  const items: ShopItem[] = [];
  let pi = 0;
  let ji = 0;
  let ci = 0;
  let paki = 0;
  for (let slot = 0; slot < SHOP_ITEM_COUNT; slot++) {
    // Pack roll is rolled first (uncommon) — lets a slot occasionally surface a booster instead of joker/planet.
    const rollPack = packPool.length > 0 && rng() < PACK_WEIGHT;
    if (rollPack && paki < packPool.length) {
      items.push(makePackItem(packPool[paki++]!, discountPct));
      continue;
    }
    const rollJoker = rng() < JOKER_WEIGHT;
    if (rollJoker && ji < jokerPool.length) {
      items.push(makeJokerItem(jokerPool[ji++]!, discountPct));
      continue;
    }
    // Non-joker slot: small chance to roll a consumable instead of a planet (only when catalog is populated).
    const rollConsumable = consumablePool.length > 0 && rng() < CONSUMABLE_WEIGHT;
    if (rollConsumable && ci < consumablePool.length) {
      items.push(makeConsumableItem(consumablePool[ci++]!, discountPct));
    } else if (pi < planetPool.length) {
      items.push(makePlanetItem(planetPool[pi++]!, run.handLevels, discountPct));
    } else if (ci < consumablePool.length) {
      items.push(makeConsumableItem(consumablePool[ci++]!, discountPct));
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
  else if (item.kind === "joker") run.jokers.push(item.jokerId);
  else if (item.kind === "consumable") {
    run.consumables.push({ id: crypto.randomUUID(), defId: item.consumableId });
  } else if (item.kind === "pack") {
    // Booster pack — remove from shop and open it (status → "pack_open").
    run.shop.items.splice(idx, 1);
    openPack(run, item.packId, "shop");
    return;
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

// ---- pack opening flow ----------------------------------------------------------

/**
 * Generate a pack's contents and transition the run to `pack_open`.
 * `returnStatus` is where the run returns when the pack closes — "shop" for
 * a shop-bought pack, "selecting_blind" for a free pack from a Standard tag.
 *
 * NB: cost is NOT charged here — `buyItem` (or the free_pack tag handler) is
 * responsible for that, since free packs explicitly bypass the cost.
 */
export function openPack(
  run: RunState,
  packId: string,
  returnStatus: "shop" | "selecting_blind",
  rng: () => number = Math.random,
): void {
  const def = PACK_BY_ID.get(packId);
  if (!def) throw new GameError(400, "unknown_pack", `Unknown pack: ${packId}`);
  const contents = rollPackContents(run, def, rng);
  const opening: OpeningPack = {
    packId: def.id,
    packKind: def.kind,
    size: def.size,
    remainingPicks: Math.min(def.choices, contents.length),
    contents,
    returnStatus,
  };
  run.openingPack = opening;
  run.status = "pack_open";
}

/**
 * Apply the player's picks. `itemIds` must be a non-empty subset of
 * openingPack.contents with length <= remainingPicks. Each picked item is
 * applied (push to consumables / level hand / push joker / push playing
 * card) and removed from the pool. When remainingPicks hits 0 the pack
 * closes and the run returns to its prior status.
 */
export function pickFromPack(run: RunState, itemIds: unknown): void {
  if (run.status !== "pack_open" || !run.openingPack) {
    throw new GameError(409, "bad_state", "No pack is open");
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new GameError(400, "invalid_selection", "itemIds must be a non-empty array");
  }
  const pack = run.openingPack;
  if (itemIds.length > pack.remainingPicks) {
    throw new GameError(400, "invalid_selection", `At most ${pack.remainingPicks} pick(s) left`);
  }
  const seen = new Set<string>();
  const picks: PackChoiceItem[] = [];
  for (const raw of itemIds) {
    if (typeof raw !== "string") {
      throw new GameError(400, "invalid_selection", "item ids must be strings");
    }
    if (seen.has(raw)) {
      throw new GameError(400, "invalid_selection", "duplicate item ids in pick");
    }
    seen.add(raw);
    const found = pack.contents.find((c) => c.id === raw);
    if (!found) {
      throw new GameError(400, "invalid_selection", `pack item ${raw} not on offer`);
    }
    picks.push(found);
  }

  for (const pick of picks) applyPackPick(run, pick);

  // Remove picked items from the pool regardless of whether the effect cap'd silently.
  const remove = new Set(picks.map((p) => p.id));
  pack.contents = pack.contents.filter((c) => !remove.has(c.id));
  pack.remainingPicks -= picks.length;
  if (pack.remainingPicks <= 0) closePack(run);
}

/** Player chose to skip — close the pack without applying anything. */
export function skipPack(run: RunState): void {
  if (run.status !== "pack_open" || !run.openingPack) {
    throw new GameError(409, "bad_state", "No pack is open");
  }
  closePack(run);
}

function closePack(run: RunState): void {
  const ret = run.openingPack?.returnStatus ?? "shop";
  run.openingPack = null;
  run.status = ret;
}

function applyPackPick(run: RunState, pick: PackChoiceItem): void {
  switch (pick.kind) {
    case "tarot":
    case "spectral": {
      if (run.consumables.length >= effectiveMaxConsumables(run)) return; // silently cap
      run.consumables.push({ id: crypto.randomUUID(), defId: pick.defId });
      return;
    }
    case "planet": {
      levelUpHand(run, pick.hand);
      return;
    }
    case "joker": {
      if (run.jokers.length >= effectiveMaxJokers(run)) return; // silently cap
      if (run.jokers.includes(pick.jokerId)) return; // dedup if player owns it
      run.jokers.push(pick.jokerId);
      return;
    }
    case "playing_card": {
      // Add a copy of the face to the deck composition (next shuffle reflects it),
      // and persist any rolled enhancement/edition so the new instance gets the mod.
      run.deckComposition.push(pick.faceCode);
      if (pick.enhancement || pick.edition || pick.seal) {
        if (!run.deckEnhancements) run.deckEnhancements = {};
        // The instance id at deal-time follows `${faceCode}-${n}` from instantiateDeck.
        // We don't know `n` yet, but persisting under the face code lets the next
        // shuffle attach via the highest-n instance. Use the face-code key as a
        // fallback marker; PET-75 may switch this to a per-face-pending list.
        run.deckEnhancements[pick.faceCode] = {
          ...(run.deckEnhancements[pick.faceCode] ?? {}),
          ...(pick.enhancement ? { enhancement: pick.enhancement } : {}),
          ...(pick.edition ? { edition: pick.edition } : {}),
          ...(pick.seal ? { seal: pick.seal } : {}),
        };
      }
      return;
    }
  }
}

/** Roll the contents pool for `def` — used by openPack and by tests. */
function rollPackContents(run: RunState, def: PackDef, rng: () => number): PackChoiceItem[] {
  const out: PackChoiceItem[] = [];
  switch (def.kind) {
    case "arcana": {
      const pool = CONSUMABLES.filter((c) => c.kind === "tarot");
      const shuffled = shuffle(pool, rng);
      for (let i = 0; i < Math.min(def.contents, shuffled.length); i++) {
        const c = shuffled[i]!;
        out.push({
          kind: "tarot",
          id: `arcana:${i}:${c.id}`,
          defId: c.id,
          name: c.name,
          description: c.description,
        });
      }
      return out;
    }
    case "celestial": {
      const shuffled = shuffle(PLANETS, rng);
      for (let i = 0; i < Math.min(def.contents, shuffled.length); i++) {
        const p = shuffled[i]!;
        out.push({
          kind: "planet",
          id: `celestial:${i}:${p.id}`,
          planet: p.id,
          hand: p.hand,
          name: p.name,
          description: `Levels up ${p.hand}`,
        });
      }
      return out;
    }
    case "buffoon": {
      const owned = new Set(run.jokers);
      const pool = JOKERS.filter((j) => !owned.has(j.id));
      const shuffled = shuffle(pool, rng);
      for (let i = 0; i < Math.min(def.contents, shuffled.length); i++) {
        const j = shuffled[i]!;
        out.push({
          kind: "joker",
          id: `buffoon:${i}:${j.id}`,
          jokerId: j.id,
          name: j.name,
          description: j.description,
        });
      }
      return out;
    }
    case "spectral": {
      const pool = CONSUMABLES.filter((c) => c.kind === "spectral");
      const shuffled = shuffle(pool, rng);
      for (let i = 0; i < Math.min(def.contents, shuffled.length); i++) {
        const c = shuffled[i]!;
        out.push({
          kind: "spectral",
          id: `spectral:${i}:${c.id}`,
          defId: c.id,
          name: c.name,
          description: c.description,
        });
      }
      // Spectral catalog is empty in PET-71 — pack may be empty until PET-72.
      return out;
    }
    case "standard": {
      // Random playing cards, optional small chance of enhancement/edition.
      for (let i = 0; i < def.contents; i++) {
        const rank = ALL_RANKS[Math.floor(rng() * ALL_RANKS.length)]!;
        const suit = ALL_SUITS[Math.floor(rng() * ALL_SUITS.length)]!;
        const code = faceCode({ rank, suit });
        const enhancement = rollEnhancement(rng);
        const edition = rollEdition(rng);
        const labelParts: string[] = [];
        if (edition) labelParts.push(edition);
        if (enhancement) labelParts.push(enhancement);
        labelParts.push(code);
        out.push({
          kind: "playing_card",
          id: `standard:${i}:${code}`,
          rank,
          suit,
          faceCode: code,
          ...(enhancement ? { enhancement } : {}),
          ...(edition ? { edition } : {}),
          name: labelParts.join(" "),
          description: `Adds a ${labelParts.join(" ")} to your deck`,
        });
      }
      return out;
    }
  }
}

/** 10% chance: any of the 8 enhancements. Returns undefined for a plain card. */
function rollEnhancement(rng: () => number): CardEnhancement | undefined {
  if (rng() >= 0.1) return undefined;
  const pool: CardEnhancement[] = ["bonus", "mult", "wild", "glass", "steel", "stone", "gold", "lucky"];
  return pool[Math.floor(rng() * pool.length)];
}

/** 5% chance: foil/holo/poly (negative is rare and skipped at this stream). */
function rollEdition(rng: () => number): CardEdition | undefined {
  if (rng() >= 0.05) return undefined;
  const pool: CardEdition[] = ["foil", "holo", "poly"];
  return pool[Math.floor(rng() * pool.length)];
}
