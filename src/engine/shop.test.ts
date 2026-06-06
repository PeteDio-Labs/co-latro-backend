import { describe, expect, it } from "bun:test";
import {
  buyItem,
  generateShop,
  levelUpHand,
  rerollShop,
  SHOP_ITEM_COUNT,
  type JokerShopItem,
  type PlanetShopItem,
} from "./shop.ts";
import { startRun } from "./run.ts";
import { GameError } from "./errors.ts";

const planetSaturn: PlanetShopItem = {
  id: "planet:saturn",
  kind: "planet",
  planet: "saturn",
  hand: "straight",
  name: "Saturn",
  cost: 3,
  addChips: 30,
  addMult: 3,
  targetLevel: 2,
};

const jokerItem = (jokerId: string, cost: number): JokerShopItem => ({
  id: `joker:${jokerId}`,
  kind: "joker",
  jokerId,
  name: jokerId,
  description: "",
  cost,
  rarity: "common",
});

describe("generateShop", () => {
  it("planet roll (rng→0.99): 3 distinct planets, rerollCost 5", () => {
    const shop = generateShop(startRun("medium", "u"), () => 0.99);
    expect(shop.items.length).toBe(SHOP_ITEM_COUNT);
    expect(shop.items.every((i) => i.kind === "planet")).toBe(true);
    expect(new Set(shop.items.map((i) => i.id)).size).toBe(SHOP_ITEM_COUNT);
    expect(shop.rerollCost).toBe(5);
  });

  it("joker roll (rng→0.3): 3 distinct jokers, none already owned", () => {
    const run = startRun("medium", "u");
    run.jokers = ["joker"]; // owned — must be excluded
    // 0.3 >= PACK_WEIGHT (0.1) → no pack; 0.3 < JOKER_WEIGHT (0.45) → joker each slot.
    const shop = generateShop(run, () => 0.3);
    expect(shop.items.every((i) => i.kind === "joker")).toBe(true);
    expect(new Set(shop.items.map((i) => i.id)).size).toBe(SHOP_ITEM_COUNT);
    expect(shop.items.some((i) => i.kind === "joker" && i.jokerId === "joker")).toBe(false);
  });
});

describe("buyItem — planet", () => {
  it("levels the hand, deducts money, removes the item", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 10;
    run.shop = { items: [{ ...planetSaturn }], rerollCost: 5, voucher: null };
    buyItem(run, "planet:saturn");
    expect(run.money).toBe(7);
    expect(run.handLevels.straight).toBe(2);
    expect(run.shop.items.length).toBe(0);
  });
});

describe("buyItem — joker", () => {
  it("adds the joker, deducts money, removes the item", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 10;
    run.shop = { items: [jokerItem("joker", 2)], rerollCost: 5, voucher: null };
    buyItem(run, "joker:joker");
    expect(run.jokers).toEqual(["joker"]);
    expect(run.money).toBe(8);
    expect(run.shop.items.length).toBe(0);
  });

  it("rejects when joker slots are full — money unchanged", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 100;
    run.jokers = ["joker", "jolly_joker", "sly_joker", "half_joker", "banner"]; // 5 = MAX
    run.shop = { items: [jokerItem("the_duo", 8)], rerollCost: 5, voucher: null };
    expect(() => buyItem(run, "joker:the_duo")).toThrow(GameError);
    expect(run.money).toBe(100);
    expect(run.jokers.length).toBe(5);
  });
});

describe("Neptune shared level", () => {
  it("levels straight flush AND royal flush together", () => {
    const run = startRun("medium", "u");
    levelUpHand(run, "straight_flush");
    expect(run.handLevels.straight_flush).toBe(2);
    expect(run.handLevels.royal_flush).toBe(2);
  });
});

describe("rerollShop", () => {
  it("deducts rerollCost and increments 5 → 6 → 7", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 100;
    run.shop = generateShop(run, () => 0.99);
    rerollShop(run, () => 0.99);
    expect(run.money).toBe(95);
    expect(run.shop!.rerollCost).toBe(6);
    rerollShop(run, () => 0.99);
    expect(run.money).toBe(89);
    expect(run.shop!.rerollCost).toBe(7);
  });

  it("rejects when it can't be afforded", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 0;
    run.shop = generateShop(run, () => 0.99);
    expect(() => rerollShop(run)).toThrow(GameError);
  });
});
