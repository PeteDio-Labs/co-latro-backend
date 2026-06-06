/**
 * Run engine — the ante→blind state machine + run context (deck composition, hand levels, shop).
 * All run transitions live here. Reuses the PURE evaluator/scoring. `deck`/`deckComposition` are
 * server-only and never cross toRunDTO().
 */

import {
  faceCode,
  instantiateDeck,
  parseFace,
  shuffle,
  type Card,
  type CardEdition,
  type CardEnhancement,
  type CardSeal,
  type Face,
  type Rank,
  type Suit,
} from "../cards.ts";
import { HAND_SIZE, MAX_SELECT, type Difficulty } from "../difficulty.ts";
import {
  defaultHandLevels,
  scoreHand,
  type HandLevels,
  type HandType,
  type ScoreBreakdown,
  type ScoreContext,
} from "../scoring.ts";
import {
  DIFFICULTY_TUNING,
  MAX_ANTE,
  blindKind,
  blindTarget,
  cashOutMoney,
  type BlindKind,
  type CashOutBreakdown,
} from "./ante.ts";
import { getDeck } from "./decks.ts";
import { generateShop, levelUpHand, type ShopState } from "./shop.ts";
import { JOKERS, getJoker, sellValue } from "./jokers.ts";
import { GameError } from "./errors.ts";
import {
  CONSUMABLE_BY_ID,
  consumablesByKind,
  type ConsumableDef,
  type ConsumableEffect,
  type ConsumableInstance,
} from "./consumables.ts";
import { VOUCHER_BY_ID } from "./vouchers.ts";
import { TAGS, TAG_BY_ID, type TagTrigger } from "./tags.ts";
import { BOSS_EFFECT_BY_ID, effectiveBossTargetMult, rollBossEffect } from "./boss.ts";
import {
  effectiveExtraDiscards,
  effectiveExtraHands,
  effectiveInterestCap,
  effectiveMaxConsumables,
  effectiveMaxJokers,
} from "./effectives.ts";

export { GameError } from "./errors.ts";

export type RunStatus = "selecting_blind" | "playing" | "shop" | "won_run" | "lost_run";

export interface PlayResult {
  playedCardIds: string[];
  breakdown: ScoreBreakdown;
}

/** Authoritative server state for a run. `deck`/`deckComposition` are NEVER serialized to the client. */
export interface RunState {
  runId: string;
  userId: string;
  difficulty: Difficulty;

  deckId: string;
  deckName: string;
  deckComposition: string[]; // HIDDEN — face codes the run plays with

  ante: number; // 1..MAX_ANTE
  blindIndex: number; // 0 small, 1 big, 2 boss
  money: number;
  handLevels: HandLevels;
  jokers: string[]; // ordered joker ids (catalog lookup); order affects scoring

  // ----- current blind -----
  target: number;
  totalScore: number;
  hand: Card[];
  deck: Card[]; // HIDDEN
  handsRemaining: number;
  discardsRemaining: number;
  lastPlay: PlayResult | null;

  status: RunStatus;
  pendingReward: number | null;
  pendingRewardBreakdown: CashOutBreakdown | null;
  shop: ShopState | null;

  // ----- extension slots (PET-67 foundation; empty-default until content streams populate) -----
  consumables: ConsumableInstance[];
  maxConsumables: number;
  vouchers: string[];
  tags: string[];
  skipsThisRun: number;
  currentBossEffect: string | null;
  jokerStates: Record<string, { counter: number }>;
  discardsUsedThisBlind: number;
  /** Marker for gold-enhancement payout at round end (PET-75 reads this). */
  heldGoldRoundEnd: boolean;

  /**
   * Per-card modifiers persisted across blinds (so a Tarot-enhanced King survives the next shuffle).
   * Keyed by card.id (`${faceCode}-${n}`). Optional so legacy persisted runs deserialize cleanly;
   * PET-75 expands this with per-card consumed-flags / triggered-seal bookkeeping.
   */
  deckEnhancements?: Record<
    string,
    { enhancement?: CardEnhancement; edition?: CardEdition; seal?: CardSeal }
  >;

  createdAt: number;
  updatedAt: number;
}

/** A joker as the client sees it (resolved from the catalog — frontend needs no catalog). */
export interface JokerView {
  id: string;
  name: string;
  description: string;
  cost: number;
  sellValue: number;
}

/** A consumable as the client sees it (resolved from CONSUMABLE_BY_ID). */
export interface ConsumableView {
  id: string; // per-run instance id
  defId: string;
  name: string;
  description: string;
  kind: "tarot" | "planet" | "spectral";
}

export interface VoucherView {
  id: string;
  name: string;
  description: string;
}

export interface TagView {
  id: string;
  name: string;
  description: string;
}

export interface BossEffectView {
  id: string;
  name: string;
  description: string;
}

/** Client-safe view: everything the UI needs, minus the hidden deck/composition. */
export interface RunStateDTO {
  runId: string;
  difficulty: Difficulty;
  deckId: string;
  deckName: string;
  ante: number;
  maxAnte: number;
  blindIndex: number;
  blindKind: BlindKind;
  money: number;
  handLevels: HandLevels;
  jokers: JokerView[];
  maxJokers: number;
  target: number;
  totalScore: number;
  hand: Card[];
  handSize: number;
  maxSelect: number;
  handsRemaining: number;
  discardsRemaining: number;
  deckRemaining: number;
  status: RunStatus;
  lastPlay: PlayResult | null;
  pendingReward: number | null;
  pendingRewardBreakdown: CashOutBreakdown | null;
  shop: ShopState | null;
  // ----- extension surface (empty by default until content streams populate) -----
  consumables: ConsumableView[];
  maxConsumables: number;
  vouchers: VoucherView[];
  tags: TagView[];
  bossEffect: BossEffectView | null;
  skipsThisRun: number;
}

/** The single chokepoint that strips the hidden deck + composition before anything reaches the client. */
export function toRunDTO(run: RunState): RunStateDTO {
  return {
    runId: run.runId,
    difficulty: run.difficulty,
    deckId: run.deckId,
    deckName: run.deckName,
    ante: run.ante,
    maxAnte: MAX_ANTE,
    blindIndex: run.blindIndex,
    blindKind: blindKind(run.blindIndex),
    money: run.money,
    handLevels: run.handLevels,
    jokers: run.jokers.map((id) => {
      const def = getJoker(id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        cost: def.cost,
        sellValue: sellValue(def.cost),
      };
    }),
    maxJokers: effectiveMaxJokers(run),
    target: run.target,
    totalScore: run.totalScore,
    hand: run.hand,
    handSize: run.hand.length,
    maxSelect: MAX_SELECT,
    handsRemaining: run.handsRemaining,
    discardsRemaining: run.discardsRemaining,
    deckRemaining: run.deck.length,
    status: run.status,
    lastPlay: run.lastPlay,
    pendingReward: run.pendingReward,
    pendingRewardBreakdown: run.pendingRewardBreakdown,
    shop: run.shop,
    consumables: run.consumables.flatMap((c) => {
      const def = CONSUMABLE_BY_ID.get(c.defId);
      if (!def) return []; // skip unknown defIds rather than crash the DTO
      return [{ id: c.id, defId: def.id, name: def.name, description: def.description, kind: def.kind }];
    }),
    maxConsumables: effectiveMaxConsumables(run),
    vouchers: run.vouchers.flatMap((id) => {
      const def = VOUCHER_BY_ID.get(id);
      return def ? [{ id: def.id, name: def.name, description: def.description }] : [];
    }),
    tags: run.tags.flatMap((id) => {
      const def = TAG_BY_ID.get(id);
      return def ? [{ id: def.id, name: def.name, description: def.description }] : [];
    }),
    bossEffect: (() => {
      if (!run.currentBossEffect) return null;
      const def = BOSS_EFFECT_BY_ID.get(run.currentBossEffect);
      return def ? { id: def.id, name: def.name, description: def.description } : null;
    })(),
    skipsThisRun: run.skipsThisRun,
  };
}

export function startRun(difficulty: Difficulty, userId: string, deckId = "standard"): RunState {
  const deck = getDeck(deckId);
  const now = Date.now();
  return {
    runId: crypto.randomUUID(),
    userId,
    difficulty,
    deckId: deck.id,
    deckName: deck.name,
    deckComposition: deck.composition.slice(),
    ante: 1,
    blindIndex: 0,
    money: deck.perk.startMoney ?? 0,
    handLevels: defaultHandLevels(),
    jokers: [],
    target: blindTarget(1, 0, difficulty), // upcoming blind's target, shown on the select screen
    totalScore: 0,
    hand: [],
    deck: [],
    handsRemaining: 0,
    discardsRemaining: 0,
    lastPlay: null,
    status: "selecting_blind",
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
    discardsUsedThisBlind: 0,
    heldGoldRoundEnd: false,
    deckEnhancements: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Deal a fresh hand for the current blind (from the run's deck composition) and begin play. */
export function startBlind(run: RunState, rng: () => number = Math.random): void {
  if (run.status !== "selecting_blind") {
    throw new GameError(409, "bad_state", "Not selecting a blind");
  }
  const faces: Face[] = run.deckComposition.map(parseFace);
  const deck = shuffle(instantiateDeck(faces), rng);
  run.hand = deck.splice(0, HAND_SIZE);
  run.deck = deck;
  // Roll the boss effect first so its modifiers fold into target / handsRemaining below.
  run.currentBossEffect = blindKind(run.blindIndex) === "boss" ? rollBossEffect(run.ante, rng) : null;
  const baseTarget = blindTarget(run.ante, run.blindIndex, run.difficulty);
  run.target = Math.round(baseTarget * effectiveBossTargetMult(run.currentBossEffect));
  run.totalScore = 0;
  const tuning = DIFFICULTY_TUNING[run.difficulty];
  const perk = getDeck(run.deckId).perk;
  run.handsRemaining = tuning.hands + (perk.extraHands ?? 0) + effectiveExtraHands(run);
  run.discardsRemaining = tuning.discards + (perk.extraDiscards ?? 0) + effectiveExtraDiscards(run);
  // The Needle: only 1 hand allowed this blind (applied after standard assignment).
  if (run.currentBossEffect === "the_needle") run.handsRemaining = 1;
  run.lastPlay = null;
  run.pendingReward = null;
  run.pendingRewardBreakdown = null;
  run.discardsUsedThisBlind = 0;
  run.status = "playing";
  if (run.currentBossEffect) applyBossEffect(run, "start");
  applyTags(run, "on_next_blind_start", rng);
}

/** Sell a joker for half its cost. Allowed while playing or shopping. */
export function sellJoker(run: RunState, jokerId: unknown): void {
  if (run.status !== "shop" && run.status !== "playing") {
    throw new GameError(409, "bad_state", "Can only manage jokers while playing or shopping");
  }
  if (typeof jokerId !== "string") {
    throw new GameError(400, "invalid_joker", "joker id must be a string");
  }
  const idx = run.jokers.indexOf(jokerId);
  if (idx < 0) throw new GameError(404, "joker_not_found", "Joker not owned");
  run.money += sellValue(getJoker(jokerId).cost);
  run.jokers.splice(idx, 1);
}

/** Move a joker one slot left/right (order affects scoring). Edge moves are no-ops. */
export function moveJoker(run: RunState, jokerId: unknown, dir: unknown): void {
  if (run.status !== "shop" && run.status !== "playing") {
    throw new GameError(409, "bad_state", "Can only manage jokers while playing or shopping");
  }
  if (typeof jokerId !== "string") {
    throw new GameError(400, "invalid_joker", "joker id must be a string");
  }
  if (dir !== "left" && dir !== "right") {
    throw new GameError(400, "invalid_dir", "dir must be 'left' or 'right'");
  }
  const i = run.jokers.indexOf(jokerId);
  if (i < 0) throw new GameError(404, "joker_not_found", "Joker not owned");
  const j = dir === "left" ? i - 1 : i + 1;
  if (j < 0 || j >= run.jokers.length) return; // edge — no-op
  const tmp = run.jokers[i]!;
  run.jokers[i] = run.jokers[j]!;
  run.jokers[j] = tmp;
}

function scoreCtx(run: RunState): ScoreContext {
  return {
    handLevels: run.handLevels,
    jokers: run.jokers,
    handsRemaining: run.handsRemaining,
    discardsRemaining: run.discardsRemaining,
  };
}

/** Non-mutating: validate the selection and return what it WOULD score (with this run's hand levels). */
export function previewSelection(run: RunState, selectedIds: unknown): ScoreBreakdown {
  const selected = resolveSelection(run, selectedIds);
  return scoreHand(selected, scoreCtx(run));
}

export function playHand(
  run: RunState,
  selectedIds: unknown,
  rng: () => number = Math.random,
): PlayResult {
  ensurePlaying(run);
  const selected = resolveSelection(run, selectedIds);
  const ids = selected.map((c) => c.id);

  // Hook for boss effects that mutate selection/scoring before resolution (PET-78).
  if (run.currentBossEffect) applyBossEffect(run, "play");

  const breakdown = scoreHand(selected, scoreCtx(run));
  run.totalScore += breakdown.score;
  run.handsRemaining -= 1;
  removeFromHand(run, ids);
  draw(run, selected.length);

  // The Hook: at the end of each played hand, discard 2 random cards and redraw.
  if (run.currentBossEffect === "the_hook") applyHookDiscard(run, rng);

  const result: PlayResult = { playedCardIds: ids, breakdown };
  run.lastPlay = result;
  checkTransition(run, rng);
  return result;
}

/** The Hook: remove up to 2 random cards from hand and draw replacements (capped by deck). */
function applyHookDiscard(run: RunState, rng: () => number): void {
  const toRemove = Math.min(2, run.hand.length);
  for (let i = 0; i < toRemove; i++) {
    const idx = Math.floor(rng() * run.hand.length);
    run.hand.splice(idx, 1);
  }
  draw(run, toRemove);
}

export function discardCards(
  run: RunState,
  selectedIds: unknown,
  rng: () => number = Math.random,
): void {
  ensurePlaying(run);
  if (run.discardsRemaining <= 0) {
    throw new GameError(400, "no_discards", "No discards remaining");
  }
  const selected = resolveSelection(run, selectedIds);
  const ids = selected.map((c) => c.id);

  run.discardsRemaining -= 1;
  run.discardsUsedThisBlind += 1;
  removeFromHand(run, ids);
  draw(run, selected.length);
  checkTransition(run, rng); // only the softlock guard is reachable here (no score change)
}

/** From the cash-out/shop screen, advance to the next blind / ante, or win the run. */
export function continueRun(run: RunState): void {
  if (run.status !== "shop") {
    throw new GameError(409, "bad_state", "Not at the cash-out screen");
  }
  run.pendingReward = null;
  run.pendingRewardBreakdown = null;
  run.shop = null;
  if (run.blindIndex < 2) {
    run.blindIndex += 1;
    run.status = "selecting_blind";
  } else if (run.ante < MAX_ANTE) {
    run.ante += 1;
    run.blindIndex = 0;
    run.status = "selecting_blind";
  } else {
    run.status = "won_run";
  }
  if (run.status === "selecting_blind") {
    run.target = blindTarget(run.ante, run.blindIndex, run.difficulty); // upcoming blind's target
  }
}

// ---- deck peek (grouped counts; sorted, so it never reveals draw order) --------------------

export interface GroupedFaces {
  byRank: Record<string, number>;
  bySuit: Record<string, number>;
  total: number;
  faces: { code: string; rank: Rank; suit: Suit; count: number }[];
}

function tally(faces: Face[]): GroupedFaces {
  const byRank: Record<string, number> = {};
  const bySuit: Record<string, number> = {};
  const byFace = new Map<string, { code: string; rank: Rank; suit: Suit; count: number }>();
  for (const f of faces) {
    byRank[f.rank] = (byRank[f.rank] ?? 0) + 1;
    bySuit[f.suit] = (bySuit[f.suit] ?? 0) + 1;
    const code = faceCode(f);
    const entry = byFace.get(code) ?? { code, rank: f.rank, suit: f.suit, count: 0 };
    entry.count += 1;
    byFace.set(code, entry);
  }
  const facesList = [...byFace.values()].sort(
    (a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit),
  );
  return { byRank, bySuit, total: faces.length, faces: facesList };
}

export function groupRemaining(run: RunState): GroupedFaces {
  return tally(run.deck.map((c) => ({ rank: c.rank, suit: c.suit })));
}

export function groupComposition(run: RunState): GroupedFaces {
  return tally(run.deckComposition.map(parseFace));
}

// ---- internals -------------------------------------------------------------

function ensurePlaying(run: RunState): void {
  if (run.status !== "playing") {
    throw new GameError(409, "game_over", "No blind in progress");
  }
}

/** Win → shop (+reward, generate shop), then lose-on-exhaustion, then a softlock guard. */
function checkTransition(run: RunState, rng: () => number): void {
  if (run.totalScore >= run.target) {
    if (run.currentBossEffect) applyBossEffect(run, "end");
    const breakdown = cashOutMoney(
      run.blindIndex,
      run.handsRemaining,
      run.money,
      effectiveInterestCap(run),
    );
    run.pendingRewardBreakdown = breakdown;
    run.pendingReward = breakdown.blindBase + breakdown.handsBonus + breakdown.interest;
    run.money += run.pendingReward;
    run.status = "shop";
    run.shop = generateShop(run, rng);
    applyTags(run, "on_shop_enter", rng);
  } else if (run.handsRemaining <= 0) {
    run.status = "lost_run";
  } else if (run.hand.length === 0 && run.deck.length === 0) {
    run.status = "lost_run"; // can no longer act
  }
}

// ---- extension hooks (skeletons; no-ops when catalogs are empty) -----------

/** Iterate run.tags and fire those matching `trigger`. Tags fire once and are removed. */
function applyTags(run: RunState, trigger: TagTrigger, rng: () => number = Math.random): void {
  if (run.tags.length === 0) return;
  const remaining: string[] = [];
  for (const id of run.tags) {
    const def = TAG_BY_ID.get(id);
    if (!def) continue; // drop unknown ids
    if (def.trigger !== trigger) {
      remaining.push(id);
      continue;
    }
    const effect = def.effect;
    switch (effect.kind) {
      case "money_add": {
        run.money += effect.n;
        break;
      }
      case "extra_joker_now": {
        // Drop a random joker of the desired rarity into the run (capacity-respecting).
        if (run.jokers.length >= effectiveMaxJokers(run)) {
          remaining.push(id); // no room — keep the tag for later
          continue;
        }
        const pool = JOKERS.filter((j) => j.rarity === effect.rarity);
        if (pool.length === 0) break; // no joker for that rarity → consume tag silently
        const pick = pool[Math.floor(rng() * pool.length)]!;
        run.jokers.push(pick.id);
        break;
      }
      case "mult_add_next_hand":
      case "free_voucher":
      case "free_pack": {
        // Deferred effects — packs/vouchers/transient bonuses land with PET-70 / later voucher pass.
        // Consume the tag rather than block — these were already "rolled" off the skip.
        break;
      }
      default: {
        const _exhaustive: never = effect;
        void _exhaustive;
        break;
      }
    }
  }
  run.tags = remaining;
}

/** Apply the active boss effect for a given phase. No-op when no boss effect set. */
function applyBossEffect(run: RunState, _phase: "start" | "play" | "end"): void {
  if (!run.currentBossEffect) return;
  const def = BOSS_EFFECT_BY_ID.get(run.currentBossEffect);
  if (!def) return;
  // Content stream PET-78 wires phase-specific behavior off `def` here.
}

/** Use a consumable from a run slot. PET-71 tarot effects; PET-72 spectral extends the switch. */
export function useConsumable(
  run: RunState,
  instanceId: unknown,
  selectedCardIds?: unknown,
  rng: () => number = Math.random,
): void {
  if (run.status !== "playing" && run.status !== "shop") {
    throw new GameError(409, "bad_state", "Can only use consumables while playing or shopping");
  }
  if (typeof instanceId !== "string") {
    throw new GameError(400, "invalid_consumable", "instanceId must be a string");
  }
  const idx = run.consumables.findIndex((c) => c.id === instanceId);
  if (idx < 0) throw new GameError(404, "consumable_not_found", "Consumable not owned");
  const inst = run.consumables[idx]!;
  const def = CONSUMABLE_BY_ID.get(inst.defId);
  if (!def) throw new GameError(400, "unimplemented", "Consumable effect not implemented");

  // Resolve selection up front so each effect arm gets validated card refs (or an empty array
  // for selection-less effects). Effects that need 2 ordered selections — e.g. Death's copy_card —
  // read selectedCardIds directly so input order is preserved (resolveCardsFromHand keeps order).
  const ids = resolveConsumableSelection(def, selectedCardIds);
  const selectedCards = resolveCardsFromHand(run, ids);

  applyConsumableEffect(run, def.effect, selectedCards, ids, rng);

  // Consume the instance regardless of effect (noop / deferred still uses the slot).
  run.consumables.splice(idx, 1);
}

/**
 * Validate that the selection matches def.needsSelection (count + uniqueness + string ids).
 * Source-of-cards validation (hand vs jokers) is delegated to the per-source resolver below.
 */
function resolveConsumableSelection(
  def: ConsumableDef,
  selectedCardIds: unknown,
): string[] {
  if (!def.needsSelection) {
    if (selectedCardIds !== undefined) {
      // Tolerate an empty array passed by clients that always send the field.
      if (Array.isArray(selectedCardIds) && selectedCardIds.length === 0) return [];
      if (Array.isArray(selectedCardIds))
        throw new GameError(
          400,
          "invalid_selection",
          "This consumable does not take a card selection",
        );
    }
    return [];
  }
  const { min, max } = def.needsSelection;
  if (!Array.isArray(selectedCardIds)) {
    throw new GameError(400, "invalid_selection", "selectedCardIds must be an array");
  }
  if (selectedCardIds.length < min || selectedCardIds.length > max) {
    throw new GameError(
      400,
      "invalid_selection",
      `Select between ${min} and ${max} card${max === 1 ? "" : "s"}`,
    );
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of selectedCardIds) {
    if (typeof raw !== "string") {
      throw new GameError(400, "invalid_selection", "card ids must be strings");
    }
    if (seen.has(raw)) {
      throw new GameError(400, "invalid_selection", "duplicate card ids in selection");
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/** Look up each id in the current hand, preserving input order. Throws on missing ids. */
function resolveCardsFromHand(run: RunState, ids: string[]): Card[] {
  if (ids.length === 0) return [];
  const byId = new Map(run.hand.map((c) => [c.id, c]));
  return ids.map((id) => {
    const card = byId.get(id);
    if (!card) {
      throw new GameError(400, "invalid_selection", `card ${id} is not in hand`);
    }
    return card;
  });
}

function recordDeckMod(
  run: RunState,
  cardId: string,
  patch: { enhancement?: CardEnhancement; edition?: CardEdition; seal?: CardSeal },
): void {
  if (!run.deckEnhancements) run.deckEnhancements = {};
  run.deckEnhancements[cardId] = { ...(run.deckEnhancements[cardId] ?? {}), ...patch };
}

/** All standard poker HandTypes that a level-random-hand tarot can pick from. */
const LEVELABLE_HANDS: HandType[] = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
];

function applyConsumableEffect(
  run: RunState,
  effect: ConsumableEffect,
  selectedCards: Card[],
  selectedIds: string[],
  rng: () => number,
): void {
  switch (effect.kind) {
    case "noop":
      return;
    case "enhance_selected": {
      for (const card of selectedCards) {
        card.enhancement = effect.enhancement;
        recordDeckMod(run, card.id, { enhancement: effect.enhancement });
      }
      return;
    }
    case "edition_selected": {
      for (const card of selectedCards) {
        card.edition = effect.edition;
        recordDeckMod(run, card.id, { edition: effect.edition });
      }
      return;
    }
    case "seal_selected": {
      for (const card of selectedCards) {
        card.seal = effect.seal;
        recordDeckMod(run, card.id, { seal: effect.seal });
      }
      return;
    }
    case "destroy_selected": {
      // Remove from hand AND from deckComposition (one face-code occurrence per destroyed card).
      const toRemove = new Set(selectedIds);
      run.hand = run.hand.filter((c) => !toRemove.has(c.id));
      for (const card of selectedCards) {
        const code = faceCode({ rank: card.rank, suit: card.suit });
        const compIdx = run.deckComposition.indexOf(code);
        if (compIdx >= 0) run.deckComposition.splice(compIdx, 1);
        // Drop any persisted modifier for the destroyed instance — it's gone.
        if (run.deckEnhancements) delete run.deckEnhancements[card.id];
      }
      return;
    }
    case "increase_rank_selected": {
      for (const card of selectedCards) {
        if (card.rank >= 13) continue; // cap at King — Aces and Kings are no-op
        const oldCode = faceCode({ rank: card.rank, suit: card.suit });
        card.rank = (card.rank + 1) as Rank;
        const newCode = faceCode({ rank: card.rank, suit: card.suit });
        // Mirror the rank bump into deckComposition so the next shuffle reflects it.
        const compIdx = run.deckComposition.indexOf(oldCode);
        if (compIdx >= 0) run.deckComposition[compIdx] = newCode;
      }
      return;
    }
    case "copy_card": {
      // Death: first selected card becomes a copy of the second (rank+suit), keeping its own id
      // and any modifiers on the *source* card carry over so the copy is visually identical.
      if (selectedCards.length !== 2) {
        throw new GameError(400, "invalid_selection", "Copy requires exactly 2 selected cards");
      }
      const [dst, src] = selectedCards as [Card, Card];
      const oldCode = faceCode({ rank: dst.rank, suit: dst.suit });
      dst.rank = src.rank;
      dst.suit = src.suit;
      if (src.enhancement) dst.enhancement = src.enhancement;
      else delete dst.enhancement;
      if (src.edition) dst.edition = src.edition;
      else delete dst.edition;
      if (src.seal) dst.seal = src.seal;
      else delete dst.seal;
      const newCode = faceCode({ rank: dst.rank, suit: dst.suit });
      const compIdx = run.deckComposition.indexOf(oldCode);
      if (compIdx >= 0) run.deckComposition[compIdx] = newCode;
      return;
    }
    case "create_consumable": {
      const pool = consumablesByKind(effect.kind2);
      if (pool.length === 0) return; // empty catalog → silently no-op (e.g. spectral not shipped yet)
      const cap = effectiveMaxConsumables(run);
      for (let i = 0; i < effect.count; i++) {
        if (run.consumables.length >= cap) return;
        const pick = pool[Math.floor(rng() * pool.length)]!;
        run.consumables.push({ id: crypto.randomUUID(), defId: pick.id });
      }
      return;
    }
    case "double_money": {
      const gain = Math.min(run.money, effect.cap);
      run.money += gain;
      return;
    }
    case "sell_jokers_value": {
      let total = 0;
      for (const jid of run.jokers) total += sellValue(getJoker(jid).cost);
      run.money += Math.min(total, effect.cap);
      return;
    }
    case "level_random_hand": {
      for (let i = 0; i < effect.n; i++) {
        const pick = LEVELABLE_HANDS[Math.floor(rng() * LEVELABLE_HANDS.length)]!;
        levelUpHand(run, pick);
      }
      return;
    }
  }
}

/** Sell a consumable for half its catalog cost. Mirrors sellJoker. */
export function sellConsumable(run: RunState, instanceId: unknown): void {
  if (run.status !== "playing" && run.status !== "shop") {
    throw new GameError(409, "bad_state", "Can only sell consumables while playing or shopping");
  }
  if (typeof instanceId !== "string") {
    throw new GameError(400, "invalid_consumable", "instanceId must be a string");
  }
  const idx = run.consumables.findIndex((c) => c.id === instanceId);
  if (idx < 0) throw new GameError(404, "consumable_not_found", "Consumable not owned");
  const inst = run.consumables[idx]!;
  const def = CONSUMABLE_BY_ID.get(inst.defId);
  // Unknown defId → fall back to a $1 refund so legacy / orphaned consumables can be cleared.
  run.money += def ? sellValue(def.cost) : 1;
  run.consumables.splice(idx, 1);
}

/** Skip the upcoming blind: roll a tag, fire immediate-triggered effects, advance the ladder. */
export function skipBlind(run: RunState, rng: () => number = Math.random): void {
  if (run.status !== "selecting_blind") {
    throw new GameError(409, "bad_state", "Can only skip from the blind-select screen");
  }
  // Balatro: only small/big are skippable — boss must be played.
  if (blindKind(run.blindIndex) === "boss") {
    throw new GameError(400, "cannot_skip_boss", "The boss blind cannot be skipped");
  }
  // Roll one tag uniformly from the catalog (defensive against an empty catalog).
  if (TAGS.length > 0) {
    const tag = TAGS[Math.floor(rng() * TAGS.length)]!;
    run.tags.push(tag.id);
  }
  run.skipsThisRun += 1;
  // Fire any "immediate" tags now (newly-rolled or carried-over).
  applyTags(run, "immediate", rng);
  // Advance: small → big, big → next ante's small. (Boss isn't skippable — guarded above.)
  if (run.blindIndex === 0) {
    run.blindIndex = 1;
  } else if (run.blindIndex === 1) {
    if (run.ante < MAX_ANTE) {
      run.ante += 1;
      run.blindIndex = 0;
    }
  }
  run.target = blindTarget(run.ante, run.blindIndex, run.difficulty);
}

function draw(run: RunState, count: number): void {
  const n = Math.min(count, run.deck.length);
  for (let i = 0; i < n; i++) {
    run.hand.push(run.deck.shift()!);
  }
}

function removeFromHand(run: RunState, ids: string[]): void {
  const remove = new Set(ids);
  run.hand = run.hand.filter((c) => !remove.has(c.id));
}

/** Validate selection (array, 1..MAX_SELECT, no dupes, all in hand) → cards in selection order. */
function resolveSelection(run: RunState, selectedIds: unknown): Card[] {
  if (!Array.isArray(selectedIds)) {
    throw new GameError(400, "invalid_selection", "selectedCardIds must be an array");
  }
  if (selectedIds.length < 1 || selectedIds.length > MAX_SELECT) {
    throw new GameError(400, "invalid_selection", `Select between 1 and ${MAX_SELECT} cards`);
  }
  const handById = new Map(run.hand.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const selected: Card[] = [];
  for (const raw of selectedIds) {
    if (typeof raw !== "string") {
      throw new GameError(400, "invalid_selection", "card ids must be strings");
    }
    if (seen.has(raw)) {
      throw new GameError(400, "invalid_selection", "duplicate card ids in selection");
    }
    seen.add(raw);
    const card = handById.get(raw);
    if (!card) {
      throw new GameError(400, "invalid_selection", `card ${raw} is not in hand`);
    }
    selected.push(card);
  }
  return selected;
}
