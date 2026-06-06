import { describe, expect, it } from "bun:test";
import {
  GameError,
  buyItem,
  generateShop,
  openPack,
  pickFromPack,
  playHand,
  skipPack,
  startRun,
  type PackShopItem,
  type RunState,
} from "../engine.ts";
import { PACK_BY_ID, PACKS } from "./packs.ts";
import { cards } from "../testkit.ts";

/** Force the shop to a known set of items so we can exercise buyItem + pack handoff deterministically. */
function makeShoppingRun(over: Partial<RunState> = {}): RunState {
  const run = startRun("medium", "u");
  run.status = "shop";
  run.money = 50;
  run.shop = { items: [], rerollCost: 5, voucher: null };
  Object.assign(run, over);
  return run;
}

const packItem = (packId: string): PackShopItem => {
  const def = PACK_BY_ID.get(packId)!;
  return {
    id: `pack:${packId}`,
    kind: "pack",
    packId,
    name: def.name,
    cost: def.cost,
    size: def.size,
    packKind: def.kind,
    choices: def.choices,
    contents: def.contents,
  };
};

describe("PACKS catalog", () => {
  it("ships 15 SKUs (5 kinds × 3 sizes), unique ids", () => {
    expect(PACKS.length).toBe(15);
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(15);
    const kinds = new Set(PACKS.map((p) => p.kind));
    expect(kinds.size).toBe(5);
  });
});

describe("generateShop — pack rolling", () => {
  it("sometimes surfaces a pack (rng path that always rolls pack)", () => {
    const run = startRun("medium", "u");
    // First rng() call per slot is the pack roll (PACK_WEIGHT=0.1 → roll < 0.1 → pack).
    // Returning 0 always picks a pack first.
    const shop = generateShop(run, () => 0);
    // Expect every slot to be a pack since rng → 0 < 0.1 every time.
    expect(shop.items.every((i) => i.kind === "pack")).toBe(true);
  });

  it("never rolls a pack when rng→0.5 (above PACK_WEIGHT)", () => {
    const run = startRun("medium", "u");
    const shop = generateShop(run, () => 0.5);
    expect(shop.items.every((i) => i.kind !== "pack")).toBe(true);
  });
});

describe("buyItem — arcana pack opens with 3 tarot choices", () => {
  it("transitions to pack_open with 3 tarots and choices=1", () => {
    const run = makeShoppingRun();
    run.shop!.items = [packItem("arcana_normal")];
    buyItem(run, "pack:arcana_normal");
    expect(run.status).toBe("pack_open");
    expect(run.money).toBe(46); // 50 - 4
    expect(run.openingPack).not.toBeNull();
    expect(run.openingPack!.contents.length).toBe(3);
    expect(run.openingPack!.remainingPicks).toBe(1);
    for (const c of run.openingPack!.contents) {
      expect(c.kind).toBe("tarot");
    }
    expect(run.shop!.items.length).toBe(0);
  });

  it("picking 1 tarot adds it to consumables and closes the pack → status returns to shop", () => {
    const run = makeShoppingRun();
    run.shop!.items = [packItem("arcana_normal")];
    buyItem(run, "pack:arcana_normal");
    const firstId = run.openingPack!.contents[0]!.id;
    pickFromPack(run, [firstId]);
    expect(run.consumables.length).toBe(1);
    expect(run.status).toBe("shop");
    expect(run.openingPack).toBeNull();
  });
});

describe("buyItem — celestial pack levels the picked hand", () => {
  it("picking a planet from a celestial pack levels its hand", () => {
    const run = makeShoppingRun();
    run.shop!.items = [packItem("celestial_normal")];
    buyItem(run, "pack:celestial_normal");
    expect(run.status).toBe("pack_open");
    const pick = run.openingPack!.contents[0]!;
    if (pick.kind !== "planet") throw new Error("expected planet pick");
    const hand = pick.hand;
    const before = run.handLevels[hand] ?? 1;
    pickFromPack(run, [pick.id]);
    expect(run.handLevels[hand]).toBe(before + 1);
    expect(run.status).toBe("shop");
  });
});

describe("buyItem — buffoon pack adds a joker", () => {
  it("picking a joker from a buffoon pack pushes it onto run.jokers", () => {
    const run = makeShoppingRun();
    run.shop!.items = [packItem("buffoon_normal")];
    buyItem(run, "pack:buffoon_normal");
    expect(run.status).toBe("pack_open");
    const pick = run.openingPack!.contents[0]!;
    if (pick.kind !== "joker") throw new Error("expected joker pick");
    pickFromPack(run, [pick.id]);
    expect(run.jokers).toContain(pick.jokerId);
    expect(run.status).toBe("shop");
  });
});

describe("skipPack", () => {
  it("closes the pack without applying anything", () => {
    const run = makeShoppingRun();
    run.shop!.items = [packItem("arcana_jumbo")]; // 1-of-5 @ $6
    buyItem(run, "pack:arcana_jumbo");
    expect(run.status).toBe("pack_open");
    skipPack(run);
    expect(run.status).toBe("shop");
    expect(run.openingPack).toBeNull();
    expect(run.consumables.length).toBe(0);
  });
});

describe("pack_open blocks playHand", () => {
  it("playHand throws while in pack_open", () => {
    const run = makeShoppingRun({ hand: cards("KH KS 3D 7C 9S") });
    run.shop!.items = [packItem("arcana_normal")];
    buyItem(run, "pack:arcana_normal");
    expect(run.status).toBe("pack_open");
    expect(() => playHand(run, ["KH"])).toThrow(GameError);
  });
});

describe("openPack — cost 0 for tag-fired packs", () => {
  it("opens a free pack without charging the player (Standard / Charm / Meteor / Buffoon tag carry)", () => {
    const run = makeShoppingRun();
    const before = run.money;
    openPack(run, "arcana_normal", "shop");
    expect(run.status).toBe("pack_open");
    expect(run.money).toBe(before); // openPack does NOT charge cost — caller is responsible
    expect(run.openingPack!.packKind).toBe("arcana");
  });

  it("applyTags free_pack consumes the tag and opens a pack on shop-enter", async () => {
    // Inject a free_pack tag def, then drive through a real blind win → shop entry path.
    const { TAG_BY_ID } = await import("./tags.ts");
    TAG_BY_ID.set("test_charm_tag", {
      id: "test_charm_tag",
      name: "Charm Tag",
      description: "Free Mega Arcana Pack",
      trigger: "on_shop_enter",
      effect: { kind: "free_pack", packKind: "arcana" },
    });
    try {
      const run = makeShoppingRun();
      // Force a win-to-shop reentry: set status to playing with a beaten target.
      run.status = "playing";
      run.tags = ["test_charm_tag"];
      run.target = 1;
      run.totalScore = 0;
      run.hand = cards("AH AS AC AD AS"); // pair → easily clears target=1
      run.handsRemaining = 1;
      run.deck = [];
      const moneyBefore = run.money;
      playHand(run, ["AH"]);
      // After playHand, the win path triggers applyTags("on_shop_enter") which fires the
      // free_pack tag, opening a pack (status → pack_open, tag consumed).
      expect(run.status as string).toBe("pack_open");
      expect(run.openingPack!.packKind).toBe("arcana");
      expect(run.tags).not.toContain("test_charm_tag");
      // No cost charged for the pack itself (cash-out reward may have changed money,
      // but the pack didn't deduct).
      expect(run.money).toBeGreaterThanOrEqual(moneyBefore);
    } finally {
      TAG_BY_ID.delete("test_charm_tag");
    }
  });
});
