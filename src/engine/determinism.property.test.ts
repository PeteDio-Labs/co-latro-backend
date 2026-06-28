/**
 * Determinism gate for the seeded-runs engine rewrite (PET-207).
 *
 * These are the fast-check property invariants the engine agent's PRs MUST keep green.
 * They assert the *invariants* (reproducibility, per-player stream isolation), NOT a specific
 * PRNG algorithm — engine functions are exercised through their already-injected `rng` seam,
 * so any conforming PRNG satisfies them.
 *
 * The `mulberry32` / `makeRng` below is a REFERENCE the rewrite can productionize as
 * `src/engine/prng.ts`. The co-op model is "parallel hands, shared blind gate": each player
 * draws from `makeRng(runSeed, playerId)`; the shared boss draws from `makeRng(runSeed, "shared")`.
 *
 * The `it.todo(...)` stubs at the bottom are the rewrite's contract (seed on RunState, replay,
 * persistence round-trip) — the engine agent turns them into real green tests.
 */
import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { makeDeck, shuffle } from "../cards.ts";
import { rollBossEffect } from "./boss.ts";
import { playHand, startBlind, startRun, type RunState } from "./run.ts";
import { cards } from "../testkit.ts";

// ---- reference keyed PRNG (the rewrite may productionize / supersede this) ----

/** mulberry32 — a small, fast, well-distributed 32-bit PRNG. Returns values in [0, 1). */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fold a string key into the run seed (FNV-1a-ish) → a per-context 32-bit seed. */
function hashKey(seed: number, key: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A fresh, deterministic stream keyed by (seed, key). Same args → same sequence. */
function makeRng(seed: number, key: string): () => number {
  return mulberry32(hashKey(seed, key));
}

/** RNG-driven fields of a run — what determinism must reproduce (excludes ids/timestamps). */
function rngFacing(run: RunState) {
  return {
    hand: run.hand,
    deck: run.deck,
    currentBossEffect: run.currentBossEffect,
    target: run.target,
    handsRemaining: run.handsRemaining,
  };
}

const seed = () => fc.integer({ min: -2_147_483_648, max: 2_147_483_647 });

// ---- reference PRNG properties (algorithm-level) ----

describe("keyed PRNG reference — determinism + isolation", () => {
  it("same (seed, key) reproduces the identical sequence", () => {
    fc.assert(
      fc.property(seed(), fc.string(), fc.integer({ min: 1, max: 64 }), (s, key, n) => {
        const a = makeRng(s, key);
        const b = makeRng(s, key);
        const seqA = Array.from({ length: n }, () => a());
        const seqB = Array.from({ length: n }, () => b());
        expect(seqA).toEqual(seqB);
      }),
    );
  });

  it("per-player streams are isolated — draining p1 does not shift p2 (the co-op invariant)", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 0, max: 50 }), fc.integer({ min: 1, max: 16 }), (s, drainP1, m) => {
        // p2 drawn fresh vs p2 drawn after p1 has been drained — must be identical.
        const p2Fresh = makeRng(s, "p2");
        const freshVals = Array.from({ length: m }, () => p2Fresh());

        const p1 = makeRng(s, "p1");
        for (let i = 0; i < drainP1; i++) p1(); // P1 rerolls their shop, etc.
        const p2After = makeRng(s, "p2");
        const afterVals = Array.from({ length: m }, () => p2After());

        expect(afterVals).toEqual(freshVals);
      }),
    );
  });

  it("emits values in [0, 1)", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 200 }), (s, n) => {
        const r = makeRng(s, "p");
        for (let i = 0; i < n; i++) {
          const v = r();
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
        }
      }),
    );
  });
});

// ---- existing-seam invariants (these already hold; the rewrite must not regress them) ----

describe("shuffle — deterministic permutation under a seeded rng", () => {
  it("same seed → identical order", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const deck = makeDeck();
        const a = shuffle(deck, makeRng(s, "p"));
        const b = shuffle(deck, makeRng(s, "p"));
        expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
      }),
    );
  });

  it("never drops or duplicates a card (permutation invariant)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const deck = makeDeck();
        const out = shuffle(deck, makeRng(s, "p"));
        expect(out.length).toBe(deck.length);
        expect(new Set(out.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
      }),
    );
  });
});

describe("startBlind — reproducible under a seeded per-player rng", () => {
  it("same seed → identical deal, boss effect, and target", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const base = startRun("medium", "u");
        base.blindIndex = 2; // boss blind — exercises shuffle + boss select + face-down
        const runA = structuredClone(base);
        const runB = structuredClone(base);
        startBlind(runA, makeRng(s, "p"));
        startBlind(runB, makeRng(s, "p"));
        expect(rngFacing(runA)).toEqual(rngFacing(runB));
      }),
    );
  });
});

describe("playHand — reproducible under a seeded per-player rng", () => {
  const playable = (): RunState => {
    const run = startRun("medium", "u");
    run.status = "playing";
    run.currentBossEffect = "the_hook"; // forces a random discard → real rng consumption
    run.hand = cards("KH KS 3D 7C 9S");
    run.deck = cards("AC AD 2H 4S 5C 6D 7H 8S");
    run.handsRemaining = 3;
    run.target = 9_999_999; // stay in "playing"
    return run;
  };

  it("same seed + same play → identical resulting hand, deck, and score", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const runA = structuredClone(playable());
        const runB = structuredClone(playable());
        const resA = playHand(runA, ["KH", "KS"], makeRng(s, "p"));
        const resB = playHand(runB, ["KH", "KS"], makeRng(s, "p"));
        expect(resA).toEqual(resB);
        expect(rngFacing(runA)).toEqual(rngFacing(runB));
        expect(runA.totalScore).toBe(runB.totalScore);
      }),
    );
  });
});

describe("shared stream — both players face the same boss", () => {
  it("rollBossEffect is identical when fed the shared stream for a run seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 8 }), (s, ante) => {
        const p1View = rollBossEffect(ante, makeRng(s, "shared"));
        const p2View = rollBossEffect(ante, makeRng(s, "shared"));
        expect(p1View).toBe(p2View);
      }),
    );
  });
});

// ---- rewrite contract: turned green by the engine agent (PET-207 phases 1–2) ----

describe("seeded-runs contract (engine-agent targets — currently unimplemented)", () => {
  it.todo("startRun accepts a seed and stores runSeed + per-player rngState on RunState", () => {});
  it.todo("replaying runSeed + the same per-player action log reproduces that player's run", () => {});
  it.todo("runSeed + rngState round-trip through saveRun / normalizeRun unchanged", () => {});
  it.todo("each player's rngState advances independently (no cross-player contamination end-to-end)", () => {});
  it.todo("startBlind draws boss selection from the SHARED stream, deck/draws from the player stream", () => {});
  it.todo("two players in one co-op session resolve the same boss for a given ante", () => {});
});
