import { describe, expect, it } from "bun:test";
import {
  GameError,
  sellConsumable,
  startBlind,
  useConsumable,
  type RunState,
} from "./run.ts";
import { CONSUMABLE_BY_ID } from "./consumables.ts";
import { faceCode, standardFaces, type Card } from "../cards.ts";
import { cards } from "../testkit.ts";
import { defaultHandLevels } from "../scoring.ts";

/** Minimal RunState fixture — mirrors the run.test.ts helper but stays local to this file. */
function makeRun(over: Partial<RunState> & { hand: Card[] }): RunState {
  return {
    runId: "test",
    userId: "u",
    difficulty: "easy",
    deckId: "standard",
    deckName: "Standard Deck",
    deckComposition: standardFaces().map(faceCode),
    ante: 1,
    blindIndex: 0,
    money: 0,
    handLevels: defaultHandLevels(),
    jokers: [],
    target: 100,
    totalScore: 0,
    deck: [],
    handsRemaining: 3,
    discardsRemaining: 3,
    lastPlay: null,
    status: "playing",
    pendingReward: null,
    pendingRewardBreakdown: null,
    shop: null,
    consumables: [],
    maxConsumables: 2,
    vouchers: [],
    tags: [],
    skipsThisRun: 0,
    currentBossEffect: null,
    jokerStates: {},
    jokerEditions: {},
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    nextHandMultBonus: 0,
    freeVoucherPending: false,
    handSizeOffset: 0,
    lastConsumableUsedDefId: null,
    deckEnhancements: {},
    openingPack: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Push a tarot instance with a deterministic instance id; returns the id for use(). */
function giveTarot(run: RunState, defId: string, instId = "inst-1"): string {
  run.consumables.push({ id: instId, defId });
  return instId;
}

describe("CONSUMABLES catalog", () => {
  it("ships the 17 tarot majors, all tarot kind, cost 3", () => {
    const tarots = [...CONSUMABLE_BY_ID.values()].filter((c) => c.kind === "tarot");
    expect(tarots.length).toBe(17);
    for (const t of tarots) {
      expect(t.cost).toBe(3);
      expect(t.kind).toBe("tarot");
    }
  });
});

describe("useConsumable — enhancements", () => {
  it("The Magician applies Lucky to 2 selected cards", () => {
    const run = makeRun({ hand: cards("KH KS 3D 7C 9S") });
    const id = giveTarot(run, "the_magician");
    useConsumable(run, id, ["KH", "KS"]);
    const kh = run.hand.find((c) => c.id === "KH")!;
    const ks = run.hand.find((c) => c.id === "KS")!;
    expect(kh.enhancement).toBe("lucky");
    expect(ks.enhancement).toBe("lucky");
    // Modifier persisted to deckEnhancements (so the next blind preserves it).
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("lucky");
    expect(run.deckEnhancements?.["KS"]?.enhancement).toBe("lucky");
    // Consumable is consumed.
    expect(run.consumables).toEqual([]);
  });

  it("The Empress applies Mult to 2 selected cards", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S 6C") });
    const id = giveTarot(run, "the_empress");
    useConsumable(run, id, ["2C", "3D"]);
    expect(run.hand.find((c) => c.id === "2C")!.enhancement).toBe("mult");
    expect(run.hand.find((c) => c.id === "3D")!.enhancement).toBe("mult");
  });

  it("The Tower applies Stone to 1 selected card", () => {
    const run = makeRun({ hand: cards("AH AD AC AS KH") });
    const id = giveTarot(run, "the_tower");
    useConsumable(run, id, ["KH"]);
    expect(run.hand.find((c) => c.id === "KH")!.enhancement).toBe("stone");
  });

  it("The Devil applies Gold to 1 selected card", () => {
    const run = makeRun({ hand: cards("AH AD AC AS KH") });
    const id = giveTarot(run, "the_devil");
    useConsumable(run, id, ["AH"]);
    expect(run.hand.find((c) => c.id === "AH")!.enhancement).toBe("gold");
  });
});

describe("useConsumable — money", () => {
  it("The Hermit doubles money capped at +$20", () => {
    const run = makeRun({ hand: cards("2C"), money: 50 });
    const id = giveTarot(run, "the_hermit");
    useConsumable(run, id);
    expect(run.money).toBe(70); // 50 + min(50, 20)
  });

  it("The Hermit doubles below the cap when money is small", () => {
    const run = makeRun({ hand: cards("2C"), money: 7 });
    const id = giveTarot(run, "the_hermit");
    useConsumable(run, id);
    expect(run.money).toBe(14); // 7 + min(7, 20)
  });

  it("Temperance pays Σ joker sell value, capped at $50", () => {
    // the_duo cost 8 → sellValue 4; joker cost 2 → sellValue 1 → total 5.
    const run = makeRun({ hand: cards("2C"), jokers: ["the_duo", "joker"], money: 0 });
    const id = giveTarot(run, "temperance");
    useConsumable(run, id);
    expect(run.money).toBe(5);
  });
});

describe("useConsumable — destruction & rank", () => {
  it("The Hanged Man removes 2 cards from hand AND deckComposition", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S 6C") });
    const beforeCount = run.deckComposition.filter((f) => f === "2C" || f === "3D").length;
    expect(beforeCount).toBe(2); // each standard face appears once
    const id = giveTarot(run, "the_hanged_man");
    useConsumable(run, id, ["2C", "3D"]);
    expect(run.hand.find((c) => c.id === "2C")).toBeUndefined();
    expect(run.hand.find((c) => c.id === "3D")).toBeUndefined();
    expect(run.deckComposition.includes("2C")).toBe(false);
    expect(run.deckComposition.includes("3D")).toBe(false);
  });

  it("Strength bumps selected card rank by 1, capping at King", () => {
    // 2H → 3H ; KH stays KH (capped).
    const run = makeRun({ hand: cards("2H KH 5C 7D 9S") });
    const id = giveTarot(run, "strength");
    useConsumable(run, id, ["2H", "KH"]);
    const twoNow = run.hand.find((c) => c.id === "2H")!;
    const kingNow = run.hand.find((c) => c.id === "KH")!;
    expect(twoNow.rank).toBe(3);
    expect(kingNow.rank).toBe(13);
    // deckComposition reflects the rank bump.
    expect(run.deckComposition.includes("3H")).toBe(true);
  });
});

describe("useConsumable — Death (copy_card)", () => {
  it("Death copies the second selection onto the first (rank+suit)", () => {
    const run = makeRun({ hand: cards("2C AS 5D 7H 9C") });
    const id = giveTarot(run, "death");
    useConsumable(run, id, ["2C", "AS"]); // first becomes a copy of second
    const dst = run.hand.find((c) => c.id === "2C")!;
    expect(dst.rank).toBe(14);
    expect(dst.suit).toBe("spades");
  });
});

describe("useConsumable — selection validation", () => {
  it("throws when selection count is wrong (The Magician needs exactly 2)", () => {
    const run = makeRun({ hand: cards("KH KS 3D") });
    const id = giveTarot(run, "the_magician");
    expect(() => useConsumable(run, id, ["KH"])).toThrow(GameError);
    // Consumable is NOT consumed on validation failure.
    expect(run.consumables.length).toBe(1);
  });

  it("throws when a selected id is not in the hand", () => {
    const run = makeRun({ hand: cards("KH KS") });
    const id = giveTarot(run, "the_magician");
    expect(() => useConsumable(run, id, ["KH", "QD"])).toThrow(GameError);
  });

  it("throws for a missing instance id", () => {
    const run = makeRun({ hand: cards("2C") });
    expect(() => useConsumable(run, "no-such-instance")).toThrow(GameError);
  });
});

describe("sellConsumable", () => {
  it("returns half the cost (cost 3 → $1) and removes the instance", () => {
    const run = makeRun({ hand: cards("2C"), money: 5 });
    const id = giveTarot(run, "the_hermit");
    sellConsumable(run, id);
    expect(run.money).toBe(6); // 5 + max(1, floor(3/2)) = 5 + 1
    expect(run.consumables).toEqual([]);
  });
});

describe("useConsumable — The Fool (copy_last_consumable)", () => {
  it("first consumable of the run: no-op (tracker null), consumable still consumed", () => {
    const run = makeRun({ hand: cards("2C"), money: 10 });
    expect(run.lastConsumableUsedDefId).toBe(null);
    const id = giveTarot(run, "the_fool");
    useConsumable(run, id);
    // Slot freed, nothing spawned, tracker still null (Fool doesn't track itself).
    expect(run.consumables).toEqual([]);
    expect(run.lastConsumableUsedDefId).toBe(null);
    expect(run.money).toBe(10);
  });

  it("after using a Tarot (Hermit), tracker is set and Fool spawns a copy of that tarot", () => {
    const run = makeRun({ hand: cards("2C"), money: 0, maxConsumables: 3 });
    const hermitId = giveTarot(run, "the_hermit", "inst-hermit");
    useConsumable(run, hermitId);
    // Hermit fired: money doubled (0+0 capped at 0 — but tracker is what matters).
    expect(run.lastConsumableUsedDefId).toBe("the_hermit");
    // Now drop in a Fool and use it.
    const foolId = giveTarot(run, "the_fool", "inst-fool");
    useConsumable(run, foolId);
    // Fool consumed, one Hermit copy spawned in slots.
    expect(run.consumables.length).toBe(1);
    expect(run.consumables[0]!.defId).toBe("the_hermit");
    // Tracker unchanged — Fool itself doesn't overwrite.
    expect(run.lastConsumableUsedDefId).toBe("the_hermit");
  });

  it("after using a Spectral (Sigil), Fool spawns no copy (spectral filter)", () => {
    const run = makeRun({ hand: cards("2C 3D 4H"), maxConsumables: 3 });
    const sigilId = giveTarot(run, "sigil", "inst-sigil");
    useConsumable(run, sigilId, undefined, () => 0);
    expect(run.lastConsumableUsedDefId).toBe("sigil");
    // Drop in a Fool — it should not spawn a copy because Sigil is spectral.
    const foolId = giveTarot(run, "the_fool", "inst-fool");
    useConsumable(run, foolId);
    // Fool consumed, no copy added.
    expect(run.consumables).toEqual([]);
    // Tracker still points at the spectral (Fool doesn't overwrite).
    expect(run.lastConsumableUsedDefId).toBe("sigil");
  });

  it("two Fools in a row after Hermit both spawn Hermit copies (Fool doesn't track itself)", () => {
    const run = makeRun({ hand: cards("2C"), maxConsumables: 4 });
    const hermitId = giveTarot(run, "the_hermit", "inst-hermit");
    useConsumable(run, hermitId);
    expect(run.lastConsumableUsedDefId).toBe("the_hermit");
    // Now give 2 Fools and use them sequentially.
    const fool1 = giveTarot(run, "the_fool", "inst-fool-1");
    const fool2 = giveTarot(run, "the_fool", "inst-fool-2");
    useConsumable(run, fool1);
    useConsumable(run, fool2);
    // Both Fools consumed, both spawned Hermits → 2 Hermit instances.
    const hermits = run.consumables.filter((c) => c.defId === "the_hermit");
    expect(hermits.length).toBe(2);
    expect(run.consumables.find((c) => c.defId === "the_fool")).toBeUndefined();
    // Tracker still hermit (Fools didn't overwrite it).
    expect(run.lastConsumableUsedDefId).toBe("the_hermit");
  });

  it("slots full: Fool's spawn is skipped, but Fool is still consumed", () => {
    // maxConsumables=2, prefill: use Hermit to set tracker, then load [Fool, Hermit] (full).
    const run = makeRun({ hand: cards("2C"), maxConsumables: 2 });
    const hermitId = giveTarot(run, "the_hermit", "inst-hermit-seed");
    useConsumable(run, hermitId);
    expect(run.lastConsumableUsedDefId).toBe("the_hermit");
    // Now fill slots: a Fool + a Hermit.
    giveTarot(run, "the_fool", "inst-fool");
    giveTarot(run, "the_hermit", "inst-hermit-kept");
    expect(run.consumables.length).toBe(2);
    // Use the Fool. With both slots occupied, the spawn is skipped.
    useConsumable(run, "inst-fool");
    // Fool consumed (slot freed), the other Hermit remains, NO new Hermit copy added.
    expect(run.consumables.length).toBe(1);
    expect(run.consumables[0]!.defId).toBe("the_hermit");
    expect(run.consumables[0]!.id).toBe("inst-hermit-kept");
  });
});

describe("useConsumable — create_consumable", () => {
  it("The Emperor pushes up to 2 random Tarot instances, respecting slot cap", () => {
    const run = makeRun({ hand: cards("2C"), maxConsumables: 3 });
    const id = giveTarot(run, "the_emperor");
    useConsumable(run, id, undefined, () => 0); // deterministic rng → first tarot in catalog
    // Started with 1 (the_emperor), used it, gained 2 → 2 remain.
    expect(run.consumables.length).toBe(2);
    for (const inst of run.consumables) {
      expect(CONSUMABLE_BY_ID.get(inst.defId)?.kind).toBe("tarot");
    }
  });
});

// ---- Spectrals (PET-72) ----------------------------------------------------

describe("CONSUMABLES catalog — spectrals", () => {
  it("ships a non-empty spectral catalog, all cost 4 and kind 'spectral'", () => {
    const spectrals = [...CONSUMABLE_BY_ID.values()].filter((c) => c.kind === "spectral");
    expect(spectrals.length).toBeGreaterThanOrEqual(12);
    for (const s of spectrals) {
      expect(s.cost).toBe(4);
      expect(s.kind).toBe("spectral");
    }
  });
});

describe("useConsumable — spectrals (deck mutations)", () => {
  it("Familiar destroys 1 hand card and appends 3 face-card faces to deckComposition", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S 6C") });
    const compBefore = run.deckComposition.length;
    const id = giveTarot(run, "familiar", "inst-fam");
    // rng → 0: destroys hand[0] (2C); adds faces deterministically.
    useConsumable(run, id, undefined, () => 0);
    // One card gone from hand, three appended to deckComposition (net +2).
    expect(run.hand.length).toBe(4);
    expect(run.deckComposition.length).toBe(compBefore - 1 + 3);
    // The 2C face was removed from composition (no longer present at all — standard deck holds one).
    expect(run.deckComposition.includes("2C")).toBe(false);
  });

  it("Grim adds 2 Aces to the deck composition", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S") });
    const compBefore = run.deckComposition.length;
    const id = giveTarot(run, "grim", "inst-grim");
    useConsumable(run, id, undefined, () => 0);
    // Net: -1 (destroyed) + 2 (added Aces) = +1 face slots.
    expect(run.deckComposition.length).toBe(compBefore - 1 + 2);
    // The 2 added faces are Aces (rank 14 → 'A'); count Ace face codes added.
    const aces = run.deckComposition.filter((f) => f.startsWith("A")).length;
    // Standard deck already has 4 Aces; Grim adds 2 → 6.
    expect(aces).toBe(6);
  });

  it("Incantation adds numbered (2-9) cards to the deck composition", () => {
    const run = makeRun({ hand: cards("KH KD KC KS") });
    const compBefore = run.deckComposition.length;
    const id = giveTarot(run, "incantation", "inst-inc");
    useConsumable(run, id, undefined, () => 0);
    // -1 destroyed, +4 numbered → net +3 face slots.
    expect(run.deckComposition.length).toBe(compBefore - 1 + 4);
  });

  it("Sigil converts every card in hand to a single random suit (and persists in composition)", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S 6C") });
    const id = giveTarot(run, "sigil", "inst-sig");
    // rng = 0 → first suit in ["clubs","diamonds","hearts","spades"] = "clubs".
    useConsumable(run, id, undefined, () => 0);
    for (const card of run.hand) {
      expect(card.suit).toBe("clubs");
    }
    // The new face codes are present in deckComposition (each rank now suit "C").
    expect(run.deckComposition.includes("2C")).toBe(true);
    expect(run.deckComposition.includes("3C")).toBe(true);
    expect(run.deckComposition.includes("4C")).toBe(true);
    expect(run.deckComposition.includes("5C")).toBe(true);
    expect(run.deckComposition.includes("6C")).toBe(true);
  });

  it("Ouija converts every card in hand to a single random rank AND shrinks handSizeOffset by 1", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S") });
    const id = giveTarot(run, "ouija", "inst-ou");
    // rng = 0 → first rank in [2..14] = 2.
    useConsumable(run, id, undefined, () => 0);
    for (const card of run.hand) {
      expect(card.rank).toBe(2);
    }
    // Ouija also subtracts 1 from the run's permanent hand size (PET-67).
    expect(run.handSizeOffset).toBe(-1);
  });

  it("Ouija on an empty hand still applies the -1 hand-size downside", () => {
    const run = makeRun({ hand: [] });
    const id = giveTarot(run, "ouija", "inst-ou2");
    useConsumable(run, id, undefined, () => 0);
    expect(run.handSizeOffset).toBe(-1);
  });
});

describe("useConsumable — spectrals (jokers + money)", () => {
  it("Wraith grants a random Rare joker and wipes money to 0", () => {
    const run = makeRun({ hand: cards("2C"), money: 50, jokers: [] });
    const id = giveTarot(run, "wraith", "inst-wr");
    useConsumable(run, id, undefined, () => 0);
    expect(run.money).toBe(0);
    expect(run.jokers.length).toBe(1);
    // The_duo is the only rare in PET-71 catalog.
    expect(run.jokers[0]).toBe("the_duo");
  });

  it("Immolate destroys 5 hand cards and gives $20", () => {
    const run = makeRun({ hand: cards("2C 3D 4H 5S 6C 7D 8H"), money: 5 });
    const id = giveTarot(run, "immolate", "inst-im");
    useConsumable(run, id, undefined, () => 0);
    expect(run.hand.length).toBe(2);
    expect(run.money).toBe(25);
  });

  it("Ankh duplicates a random owned joker and destroys the rest", () => {
    const run = makeRun({ hand: cards("2C"), jokers: ["joker", "the_duo", "banner"] });
    const id = giveTarot(run, "ankh", "inst-ankh");
    // rng = 0 → keep jokers[0] (joker), duplicate it.
    useConsumable(run, id, undefined, () => 0);
    expect(run.jokers).toEqual(["joker", "joker"]);
  });
});

describe("useConsumable — spectrals (selection-based)", () => {
  it("Talisman applies a Gold Seal to the selected card", () => {
    const run = makeRun({ hand: cards("KH 2C 3D 4H 5S") });
    const id = giveTarot(run, "talisman", "inst-tal");
    useConsumable(run, id, ["KH"]);
    expect(run.hand.find((c) => c.id === "KH")!.seal).toBe("gold");
    expect(run.deckEnhancements?.["KH"]?.seal).toBe("gold");
  });

  it("Déjà Vu applies a Red Seal to the selected card", () => {
    const run = makeRun({ hand: cards("KH 2C 3D 4H 5S") });
    const id = giveTarot(run, "deja_vu", "inst-dv");
    useConsumable(run, id, ["KH"]);
    expect(run.hand.find((c) => c.id === "KH")!.seal).toBe("red");
  });

  it("Cryptid creates 2 copies of the selected card in hand and deckComposition", () => {
    const run = makeRun({ hand: cards("AS 2C 3D") });
    const compBefore = run.deckComposition.length;
    const id = giveTarot(run, "cryptid", "inst-cr");
    useConsumable(run, id, ["AS"], () => 0);
    // 2 copies added to deckComposition.
    expect(run.deckComposition.length).toBe(compBefore + 2);
    // Hand grew by 2 clones of AS (rank 14, suit spades).
    const spadeAces = run.hand.filter((c) => c.rank === 14 && c.suit === "spades");
    expect(spadeAces.length).toBe(3); // original + 2 clones
  });
});

describe("useConsumable — spectrals (deferred placeholders)", () => {
  it("Aura is consumed but is a no-op (deferred)", () => {
    const run = makeRun({ hand: cards("2C"), money: 10 });
    const id = giveTarot(run, "aura", "inst-au");
    useConsumable(run, id);
    expect(run.money).toBe(10);
    expect(run.consumables).toEqual([]);
  });

  it("Ectoplasm is consumed but is a no-op (deferred — negative joker edition pending)", () => {
    const run = makeRun({ hand: cards("2C"), money: 10 });
    const id = giveTarot(run, "ectoplasm", "inst-ec");
    useConsumable(run, id);
    expect(run.money).toBe(10);
    expect(run.consumables).toEqual([]);
  });
});

// ---- deckEnhancements key-space (PET-67 reconciliation) -------------------
//
// These tests pin the face-code key convention. The bug they guard against: PET-71 used to write
// per-card-instance ids ("KH-0") which regenerate on every shuffle (instantiateDeck), so a tarot
// enhancement vanished on the next blind. Face-code keys ("KH") inherit onto every future
// instance of that face — see the deckEnhancements field doc + the comment in useConsumable.

describe("deckEnhancements — face-code key persistence", () => {
  it("persists an enhancement across a reshuffle (next blind's KH still has Mult)", () => {
    // Enhance KH with Mult via The Empress, then transition to selecting_blind and re-deal.
    const run = makeRun({ hand: cards("KH KS 3D 7C 9S") });
    const id = giveTarot(run, "the_empress");
    useConsumable(run, id, ["KH", "KS"]);
    // In-hand badge applied this blind.
    expect(run.hand.find((c) => c.id === "KH")!.enhancement).toBe("mult");
    // Persisted by face code (not by id "KH-0" or similar).
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("mult");

    // Reshuffle for the next blind — startBlind re-instantiates from deckComposition.
    run.status = "selecting_blind";
    startBlind(run, () => 0);

    // Every instance of KH in the new hand AND deck carries the mult enhancement.
    const allCards = [...run.hand, ...run.deck];
    const kingsOfHearts = allCards.filter((c) => c.rank === 13 && c.suit === "hearts");
    expect(kingsOfHearts.length).toBe(1);
    for (const kh of kingsOfHearts) expect(kh.enhancement).toBe("mult");
  });

  it("second enhancement of the same face overwrites the first cleanly", () => {
    // The Tower applies Stone first, then The Empress applies Mult to the same face.
    const run = makeRun({ hand: cards("KH 2C 3D 4H 5S") });
    const tower = giveTarot(run, "the_tower", "inst-tow");
    useConsumable(run, tower, ["KH"]);
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("stone");

    // Second consumable on the same face — should overwrite.
    const empress = giveTarot(run, "the_empress", "inst-emp");
    // Empress wants 2 selections — give it KH plus a filler so we can target KH specifically.
    useConsumable(run, empress, ["KH", "2C"]);
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("mult");
    // In-hand card reflects the latest enhancement too.
    expect(run.hand.find((c) => c.id === "KH")!.enhancement).toBe("mult");
  });

  it("enhancement + edition coexist on the same face (merged, not overwritten)", () => {
    // Mult enhancement via Empress, then a Foil edition via direct overlay write (no foil tarot
    // in the catalog yet — we exercise the recordDeckMod merge path through the seal_selected /
    // edition_selected family by setting deckEnhancements directly to simulate a future writer).
    const run = makeRun({ hand: cards("KH KS 3D 7C 9S") });
    const empress = giveTarot(run, "the_empress");
    useConsumable(run, empress, ["KH", "KS"]);
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("mult");

    // Simulate a future edition-on-face writer (the merge contract recordDeckMod guarantees).
    run.deckEnhancements!["KH"] = {
      ...(run.deckEnhancements!["KH"] ?? {}),
      edition: "foil",
    };

    // Reshuffle — face overlay merges enhancement + edition onto the new instance.
    run.status = "selecting_blind";
    startBlind(run, () => 0);
    const kh = [...run.hand, ...run.deck].find((c) => c.rank === 13 && c.suit === "hearts")!;
    expect(kh.enhancement).toBe("mult");
    expect(kh.edition).toBe("foil");
  });

  it("destroy_selected removes the overlay entry once the LAST instance of that face is gone", () => {
    // Enhance KH (single instance in standard deck), then The Hanged Man destroys it.
    const run = makeRun({ hand: cards("KH 2C 3D 4H 5S") });
    const tower = giveTarot(run, "the_tower", "inst-tow");
    useConsumable(run, tower, ["KH"]);
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("stone");
    expect(run.deckComposition.includes("KH")).toBe(true);

    // Hanged Man needs 2 selections — destroy KH + a filler.
    const hanged = giveTarot(run, "the_hanged_man", "inst-hng");
    useConsumable(run, hanged, ["KH", "2C"]);
    // KH no longer in composition → overlay entry pruned (avoid stale overlays piling up).
    expect(run.deckComposition.includes("KH")).toBe(false);
    expect(run.deckEnhancements?.["KH"]).toBeUndefined();
  });

  it("destroy_selected KEEPS the overlay entry when a duplicate of that face remains", () => {
    // Two KH in deckComposition (simulate Cryptid having dup'd KH earlier). Destroy one — the
    // overlay must survive because the surviving KH instance would otherwise lose its badge.
    const run = makeRun({
      hand: cards("KH 2C 3D 4H 5S"),
      deckComposition: [...standardFaces().map(faceCode), "KH"], // 53 faces, 2 KH
    });
    // Seed an enhancement on the face manually (skip the consumable to focus on the prune path).
    run.deckEnhancements = { KH: { enhancement: "mult" } };

    const hanged = giveTarot(run, "the_hanged_man", "inst-hng2");
    useConsumable(run, hanged, ["KH", "2C"]);
    // One KH gone from composition, one remains → overlay must persist.
    expect(run.deckComposition.filter((f) => f === "KH").length).toBe(1);
    expect(run.deckEnhancements?.["KH"]?.enhancement).toBe("mult");
  });
});
