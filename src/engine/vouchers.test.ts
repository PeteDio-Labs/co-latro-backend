import { describe, expect, it } from "bun:test";
import {
  effectiveExtraDiscards,
  effectiveExtraHands,
  effectiveInterestCap,
  effectiveMaxConsumables,
  effectiveMaxJokers,
  effectiveShopDiscountPct,
} from "./effectives.ts";
import { buyItem, generateShop, type VoucherShopItem } from "./shop.ts";
import { startBlind, startRun } from "./run.ts";

function voucherItem(voucherId: string, cost = 10): VoucherShopItem {
  return {
    id: `voucher:${voucherId}`,
    kind: "voucher",
    voucherId,
    name: voucherId,
    description: "",
    cost,
  };
}

describe("vouchers — effective caps", () => {
  it("Crystal Ball raises effectiveMaxConsumables 2 → 3", () => {
    const run = startRun("medium", "u");
    expect(effectiveMaxConsumables(run)).toBe(2);
    run.vouchers.push("crystal_ball");
    expect(effectiveMaxConsumables(run)).toBe(3);
  });

  it("Antimatter raises effectiveMaxJokers 5 → 6", () => {
    const run = startRun("medium", "u");
    expect(effectiveMaxJokers(run)).toBe(5);
    run.vouchers.push("antimatter");
    expect(effectiveMaxJokers(run)).toBe(6);
  });

  it("Seed Money raises effectiveInterestCap 5 → 10", () => {
    const run = startRun("medium", "u");
    expect(effectiveInterestCap(run)).toBe(5);
    run.vouchers.push("seed_money");
    expect(effectiveInterestCap(run)).toBe(10);
  });

  it("Fortune Scale raises effectiveInterestCap 5 → 10", () => {
    const run = startRun("medium", "u");
    expect(effectiveInterestCap(run)).toBe(5);
    run.vouchers.push("fortune_scale");
    expect(effectiveInterestCap(run)).toBe(10);
  });
});

describe("vouchers — startBlind grants", () => {
  it("Grabber gives +1 hand on startBlind", () => {
    const baseline = startRun("medium", "u");
    startBlind(baseline);
    const baseHands = baseline.handsRemaining;

    const run = startRun("medium", "u");
    run.vouchers.push("grabber");
    expect(effectiveExtraHands(run)).toBe(1);
    startBlind(run);
    expect(run.handsRemaining).toBe(baseHands + 1);
  });

  it("Wasteful gives +1 discard on startBlind", () => {
    const baseline = startRun("medium", "u");
    startBlind(baseline);
    const baseDiscards = baseline.discardsRemaining;

    const run = startRun("medium", "u");
    run.vouchers.push("wasteful");
    expect(effectiveExtraDiscards(run)).toBe(1);
    startBlind(run);
    expect(run.discardsRemaining).toBe(baseDiscards + 1);
  });
});

describe("vouchers — shop slot gating", () => {
  it("Money Tree is hidden from the shop until Seed Money is owned", () => {
    const run = startRun("medium", "u");
    // Deterministic rng so the shop voucher pool is fully sampled.
    for (let i = 0; i < 20; i++) {
      const shop = generateShop(run, () => i / 20);
      expect(shop.voucher?.voucherId).not.toBe("money_tree");
    }
    run.vouchers.push("seed_money");
    let sawMoneyTree = false;
    for (let i = 0; i < 200; i++) {
      const shop = generateShop(run, () => i / 200);
      if (shop.voucher?.voucherId === "money_tree") {
        sawMoneyTree = true;
        break;
      }
    }
    expect(sawMoneyTree).toBe(true);
  });

  it("does not roll an already-owned voucher (empty pool → null slot)", () => {
    const run = startRun("medium", "u");
    // Own every voucher; pool should be empty.
    run.vouchers = [
      "crystal_ball",
      "grabber",
      "wasteful",
      "antimatter",
      "reroll_surplus",
      "reroll_glut",
      "seed_money",
      "money_tree",
      "clearance_sale",
      "liquidation",
      "hieroglyph",
      "fortune_scale",
      "palette",
    ];
    const shop = generateShop(run, () => 0.5);
    expect(shop.voucher).toBeNull();
  });
});

describe("vouchers — buyItem", () => {
  it("buying Liquidation deducts cost and applies 50% shop discount to future shops", () => {
    const run = startRun("medium", "u");
    run.status = "shop";
    run.money = 50;
    run.shop = {
      items: [],
      rerollCost: 5,
      voucher: voucherItem("liquidation", 10),
    };
    buyItem(run, "voucher:liquidation");
    expect(run.money).toBe(40);
    expect(run.vouchers).toContain("liquidation");
    expect(run.shop.voucher).toBeNull();
    expect(effectiveShopDiscountPct(run)).toBe(50);
  });

  it("clearance_sale discount applies to the voucher slot's listed cost", () => {
    const run = startRun("medium", "u");
    run.vouchers.push("clearance_sale");
    // Drain every voucher except Hieroglyph so the slot lands on a known item.
    run.vouchers.push(
      "crystal_ball",
      "grabber",
      "wasteful",
      "antimatter",
      "reroll_surplus",
      "seed_money",
    );
    const shop = generateShop(run, () => 0.5);
    expect(shop.voucher).not.toBeNull();
    // 10 base × 0.75 = 7.5, rounded → 8.
    expect(shop.voucher!.cost).toBe(8);
  });
});
