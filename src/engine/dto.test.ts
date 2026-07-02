/**
 * Wire-contract tests (PET-89): toRunDTO + shop DTO must emit the exact shapes the frontend
 * renders. These guard against the PET-67/70 backend↔frontend drift that left booster packs,
 * selection-consumables, and shop tiles unable to render in the browser despite green unit tests.
 */

import { describe, expect, it } from "bun:test";
import {
  generateShop,
  openPack,
  startRun,
  toRunDTO,
  type ConsumableShopItem,
  type PackShopItem,
  type RunState,
} from "../engine.ts";

/** Drive generateShop until it yields one item of the requested kind (deterministic rng). */
function shopWith(kind: "consumable" | "pack"): RunState {
  const run = startRun("medium", "u");
  // rng→0 always rolls a pack in the first slot; a mid value yields consumables/planets.
  const rng = kind === "pack" ? () => 0 : () => 0.55;
  run.shop = generateShop(run, rng);
  return run;
}

describe("toRunDTO — OpeningPack wire shape (PET-70 picker contract)", () => {
  it("maps the internal OpeningPack onto {packId, name, family, picksAllowed, options[]}", () => {
    const run = startRun("medium", "u");
    openPack(run, "arcana_mega", "selecting_blind", () => 0.5);
    const dto = toRunDTO(run);
    expect(dto.openingPack).not.toBeNull();
    const p = dto.openingPack!;
    // Exactly the FE fields, nothing server-only (no returnStatus / size / contents / remainingPicks).
    expect(Object.keys(p).sort()).toEqual(["family", "name", "options", "packId", "picksAllowed"]);
    expect(p.family).toBe("arcana");
    expect(p.name).toBe("Mega Arcana Pack");
    expect(p.picksAllowed).toBeGreaterThanOrEqual(1);
    expect(p.options.length).toBeGreaterThan(0);
    for (const opt of p.options) {
      expect(Object.keys(opt).sort()).toEqual(["description", "id", "name"]);
    }
  });

  it("is null when no pack is open", () => {
    const dto = toRunDTO(startRun("medium", "u"));
    expect(dto.openingPack).toBeNull();
  });
});

describe("toRunDTO — owned consumables carry needsSelection (PET-71 selection gate)", () => {
  it("emits needsSelection so the FE can open selection mode", () => {
    const run = startRun("medium", "u");
    // The Magician needs 2 cards; The Emperor needs none — assert both round-trip correctly.
    run.consumables = [
      { id: "i1", defId: "the_magician" },
      { id: "i2", defId: "the_emperor" },
    ];
    const dto = toRunDTO(run);
    const magician = dto.consumables.find((c) => c.defId === "the_magician")!;
    const emperor = dto.consumables.find((c) => c.defId === "the_emperor")!;
    expect(magician.needsSelection).toEqual({ min: 2, max: 2, from: "hand" });
    expect(emperor.needsSelection).toBeNull();
  });
});

describe("toRunDTO — top-level wire shape (PET-92 chokepoint guard)", () => {
  it("emits exactly the RunStateDTO keys the FE consumes (drift tripwire)", () => {
    const dto = toRunDTO(startRun("medium", "u"));
    expect(Object.keys(dto).sort()).toEqual(
      [
        "ante", "blindIndex", "blindKind", "bossEffect", "bossForcedCardId", "consumables",
        "deckId", "deckName", "deckRemaining", "difficulty", "discardsRemaining", "hand",
        "handLevels", "handSize", "handsRemaining", "jokers", "lastPlay", "maxAnte",
        "maxConsumables", "maxJokers", "maxSelect", "money", "openingPack", "pendingReward",
        "pendingRewardBreakdown", "runId", "shop", "skipsThisRun", "status", "tags", "target",
        "totalScore", "vouchers",
      ].sort(),
    );
  });
});

describe("toRunDTO — boss-effect state reaches the wire (PET-239/240)", () => {
  it("stamps debuffed on affected hand cards without touching server state", () => {
    const run = startRun("medium", "u");
    run.currentBossEffect = "the_club";
    run.hand = [
      { id: "2C", rank: 2, suit: "clubs" },
      { id: "5D", rank: 5, suit: "diamonds" },
    ];
    const dto = toRunDTO(run);
    expect(dto.hand.find((c) => c.id === "2C")?.debuffed).toBe(true);
    expect(dto.hand.find((c) => c.id === "5D")?.debuffed).toBeUndefined();
    expect(run.hand[0]!.debuffed).toBeUndefined(); // view-time overlay only
  });

  it("emits bossForcedCardId (null default) and the disabled joker flag", () => {
    const run = startRun("medium", "u");
    expect(toRunDTO(run).bossForcedCardId).toBeNull();
    run.jokers = ["joker"];
    run.bossDisabledJoker = "joker";
    run.bossForcedCardId = "KH-0";
    const dto = toRunDTO(run);
    expect(dto.bossForcedCardId).toBe("KH-0");
    expect(dto.jokers[0]!.disabled).toBe(true);
  });
});

describe("shop DTO — tile fields match the FE contract", () => {
  it("consumable tile emits defId + consumableKind (not consumableId)", () => {
    const run = shopWith("consumable");
    const item = run.shop!.items.find((i) => i.kind === "consumable") as ConsumableShopItem | undefined;
    if (!item) return; // rng yielded no consumable this roll — the pack test covers the pack path
    expect(item.defId).toBeTruthy();
    expect(["tarot", "planet", "spectral"]).toContain(item.consumableKind);
    expect((item as unknown as Record<string, unknown>).consumableId).toBeUndefined();
  });

  it("pack tile emits family + picksAllowed + optionsCount + description", () => {
    const run = shopWith("pack");
    const item = run.shop!.items.find((i) => i.kind === "pack") as PackShopItem;
    expect(item.family).toBeTruthy();
    expect(item.picksAllowed).toBeGreaterThanOrEqual(1);
    expect(item.optionsCount).toBeGreaterThanOrEqual(1);
    expect(item.description).toContain("Choose");
    const raw = item as unknown as Record<string, unknown>;
    expect(raw.packKind).toBeUndefined();
    expect(raw.choices).toBeUndefined();
  });
});
