/**
 * Keyed, serializable PRNG for seeded runs (PET-208, foundation for PET-207).
 *
 * The engine already injects an `rng: () => number` seam everywhere randomness is drawn
 * (deck shuffle, draws, shop, packs, editions, glass break, boss select, consumables). This
 * module produces those streams deterministically.
 *
 * Co-op model is "parallel hands, shared blind gate": each player draws from their own stream
 * `makeRng(runSeed, playerId)`, and the boss both players face is drawn from the shared stream
 * `makeRng(runSeed, "shared")`. Streams keyed by distinct keys are independent — draining one
 * player's stream never shifts another's.
 *
 * Streams are serializable: `getState()` returns the internal 32-bit counter and `setState()`
 * restores it, so an `rngState` can be persisted mid-run and resume the identical sequence.
 */

/** mulberry32 — a small, fast, well-distributed 32-bit PRNG. Returns values in [0, 1). */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fold a string key into the run seed (FNV-1a-style) → a per-context 32-bit seed. */
export function hashKey(seed: number, key: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A keyed PRNG stream. Callable for the next value in [0, 1), with a serializable counter:
 * `getState()` snapshots the internal state and `setState()` restores it, so persisting the
 * state and restoring it later resumes the identical sequence.
 */
export interface Rng {
  /** Next value in [0, 1). */
  (): number;
  /** Snapshot the internal counter (a plain int — safe to persist as `rngState`). */
  getState(): number;
  /** Restore a previously snapshotted counter; subsequent draws resume the same sequence. */
  setState(state: number): void;
}

/**
 * A fresh deterministic stream keyed by `(seed, key)`. Same args → same sequence; distinct keys
 * → independent sequences. The stream carries serializable state (see {@link Rng}).
 */
export function makeRng(seed: number, key: string): Rng {
  let state = hashKey(seed, key);
  // mulberry32 stepping, inlined so the counter is observable for get/set.
  const rng = (() => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  rng.getState = () => state;
  rng.setState = (s: number) => {
    state = s | 0;
  };
  return rng;
}
