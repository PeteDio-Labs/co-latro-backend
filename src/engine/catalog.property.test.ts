/**
 * Catalog scoring invariants (PET-184, Phase 0b) — the fast-check properties the ENGINE's
 * new-effect-`kind` PRs MUST keep green. Determinism / RNG isolation live in
 * determinism.property.test.ts (PET-207/208); this file is the other four families:
 *
 *   1. never-throws     — scoring never throws over ANY owned-joker set + ANY hand + context.
 *   2. output-shape     — chips ≥ 0, mult ≥ 0, score finite & ≥ 0 (no NaN / Infinity / negative).
 *   3. additive-invariance (the `additive-guard` signal for Phase-3 auto-merge):
 *        a. with NO joker owned, no joker step leaks in — an un-owned catalog entry can't affect
 *           scoring;
 *        b. owning only entries whose gating feature is ABSENT is a no-op — adding an entry that
 *           doesn't apply never changes the score of a game that doesn't use it.
 *   4. round-trip       — a run's wire view (toRunDTO) is stable across a JSON persistence
 *           round-trip; a new kind that stores run state must survive save/load unchanged.
 *
 * These assert INVARIANTS, not a specific catalog — a new joker `kind` is exercised through the
 * same generators (it's just another id in JOKERS), so a correct handler satisfies them and a
 * leaky / unconditional / throwing one is caught. The engine's Stop-hook gate re-runs this file
 * with ENGINE_GATE=1 for a harder pass (more numRuns).
 */
import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { scoreHand, defaultHandLevels } from "../scoring.ts";
import { JOKERS } from "./jokers.ts";
import { BOSS_EFFECTS, rollBossEffect } from "./boss.ts";
import { makeDeck, type Card, type CardEdition } from "../cards.ts";
import { startRun, toRunDTO } from "./run.ts";
import { cards } from "../testkit.ts";

// Harder pass under the engine gate (ENGINE_GATE=1) than a normal `bun test`.
const RUNS = process.env.ENGINE_GATE ? 500 : 100;
const assert = <T>(a: fc.IPropertyWithHooks<T> | fc.IProperty<T>) => fc.assert(a, { numRuns: RUNS });

const DECK = makeDeck();
const JOKER_IDS = JOKERS.map((j) => j.id);
const EDITIONS: CardEdition[] = ["foil", "holo", "poly", "negative"];

/** 1–5 distinct real cards (a subset of a real deck — always valid Card objects). */
const handGen = fc.subarray(DECK, { minLength: 1, maxLength: 5 });
/** 0–5 owned joker ids (a subset of the real catalog). */
const jokersGen = fc.subarray(JOKER_IDS, { minLength: 0, maxLength: 5 });

/** A full random ScoreContext — every field a kind's handler might read. */
const ctxGen = fc.record({
  jokers: jokersGen,
  money: fc.nat({ max: 999 }),
  discardsUsedThisBlind: fc.nat({ max: 8 }),
  discardsRemaining: fc.nat({ max: 8 }),
  handsRemaining: fc.nat({ max: 8 }),
  // A random edition overlay across owned + unowned ids (exercises the edition fold too).
  jokerEditions: fc.dictionary(fc.constantFrom(...JOKER_IDS), fc.constantFrom(...EDITIONS)),
  // Cards still HELD in hand (not played) — drives steel enhancement + held_rank_x_mult (PET-231).
  handHeld: fc.subarray(DECK, { minLength: 0, maxLength: 5 }),
});

// ---- 1. never-throws -------------------------------------------------------------------
describe("scoring — never throws (any owned set, any hand, any context)", () => {
  it("scoreHand tolerates every catalog joker over arbitrary hands", () => {
    assert(
      fc.property(handGen, ctxGen, (played, ctx) => {
        expect(() => scoreHand(played, { handLevels: defaultHandLevels(), ...ctx })).not.toThrow();
      }),
    );
  });
});

// ---- 2. output-shape -------------------------------------------------------------------
describe("scoring — output shape (finite, non-negative)", () => {
  it("chips ≥ 0, mult ≥ 0, score finite & ≥ 0 — never NaN / Infinity / negative", () => {
    assert(
      fc.property(handGen, ctxGen, (played, ctx) => {
        const b = scoreHand(played, { handLevels: defaultHandLevels(), ...ctx });
        for (const n of [b.baseChips, b.baseMult, b.scoringChips, b.totalChips, b.score]) {
          expect(Number.isFinite(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
        }
        // Each joker step's deltas must be finite too (a kind can't emit NaN/Infinity chips/mult).
        for (const step of b.jokerSteps) {
          for (const d of [step.deltaChips, step.deltaMult, step.xMult]) {
            if (d !== undefined) expect(Number.isFinite(d)).toBe(true);
          }
        }
      }),
    );
  });
});

// ---- 3. additive-invariance (the additive-guard) ---------------------------------------
describe("scoring — additive-invariance (an un-used entry never changes a game)", () => {
  it("no owned joker ⇒ no joker step leaks in (an un-owned catalog entry can't score)", () => {
    assert(
      fc.property(handGen, (played) => {
        const b = scoreHand(played, { handLevels: defaultHandLevels(), jokers: [] });
        expect(b.jokerSteps).toEqual([]);
      }),
    );
  });

  it("owning only feature-gated entries whose feature is ABSENT is a no-op", () => {
    // A fixed hand with no pair/two-pair/trips/straight/flush: high card only (ranks 2,5,9,K;
    // mixed suits), so every contains_*/x_mult_contains joker is non-triggering.
    const HIGH_CARD = cards("2C 5D 9S KH");
    const NON_TRIGGERING = JOKERS.filter((j) =>
      ["contains_mult", "contains_chips", "x_mult_contains"].includes(j.effect.kind),
    ).map((j) => j.id);
    const baseline = scoreHand(HIGH_CARD, { handLevels: defaultHandLevels(), jokers: [] }).score;
    assert(
      fc.property(fc.subarray(NON_TRIGGERING, { minLength: 0, maxLength: NON_TRIGGERING.length }), (owned) => {
        const s = scoreHand(HIGH_CARD, { handLevels: defaultHandLevels(), jokers: owned }).score;
        expect(s).toBe(baseline);
      }),
    );
  });
});

// ---- boss-effect invariants (PET-92 / PET-239 / PET-240) --------------------------------
describe("boss effects — debuff + roll-pool invariants", () => {
  it("a fully-debuffed hand scores base values only, and never MORE than the clean hand", () => {
    assert(
      fc.property(handGen, (played) => {
        const clean = scoreHand(played, { handLevels: defaultHandLevels() });
        const debuffed = scoreHand(
          played.map((c) => ({ ...c, debuffed: true })),
          { handLevels: defaultHandLevels() },
        );
        // Shape survives (debuffed cards still count for hand detection)…
        expect(debuffed.handType).toBe(clean.handType);
        // …but no card contributes chips, so only the base remains.
        expect(debuffed.scoringChips).toBe(0);
        expect(debuffed.totalChips).toBe(debuffed.baseChips);
        expect(debuffed.score).toBeLessThanOrEqual(clean.score);
      }),
    );
  });

  it("rollBossEffect returns a finisher iff the ante is the final one", () => {
    const finishers = new Set(BOSS_EFFECTS.filter((b) => b.finisher).map((b) => b.id));
    assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        fc.integer({ min: 1, max: 8 }),
        (r, ante) => {
          const id = rollBossEffect(ante, () => r);
          expect(id).not.toBeNull();
          expect(finishers.has(id!)).toBe(ante === 8);
        },
      ),
    );
  });
});

// ---- 4. round-trip ---------------------------------------------------------------------
describe("run — persistence round-trip (wire view stable across JSON)", () => {
  it("toRunDTO(run) is unchanged by a JSON stringify→parse round-trip of the run", () => {
    assert(
      fc.property(jokersGen, fc.nat({ max: 999 }), (jokers, money) => {
        const run = startRun("medium", "u");
        run.jokers = jokers;
        run.money = money;
        const roundTripped: typeof run = JSON.parse(JSON.stringify(run));
        expect(toRunDTO(roundTripped)).toEqual(toRunDTO(run));
      }),
    );
  });
});
