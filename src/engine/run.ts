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
  type Face,
  type Rank,
  type Suit,
} from "../cards.ts";
import { HAND_SIZE, MAX_SELECT, type Difficulty } from "../difficulty.ts";
import {
  defaultHandLevels,
  scoreHand,
  type HandLevels,
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
} from "./ante.ts";
import { getDeck } from "./decks.ts";
import { generateShop, type ShopState } from "./shop.ts";
import { MAX_JOKERS, getJoker, sellValue } from "./jokers.ts";
import { GameError } from "./errors.ts";

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
  shop: ShopState | null;
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
  shop: ShopState | null;
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
    maxJokers: MAX_JOKERS,
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
    shop: run.shop,
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
    shop: null,
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
  run.target = blindTarget(run.ante, run.blindIndex, run.difficulty);
  run.totalScore = 0;
  const tuning = DIFFICULTY_TUNING[run.difficulty];
  const perk = getDeck(run.deckId).perk;
  run.handsRemaining = tuning.hands + (perk.extraHands ?? 0);
  run.discardsRemaining = tuning.discards + (perk.extraDiscards ?? 0);
  run.lastPlay = null;
  run.pendingReward = null;
  run.status = "playing";
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

  const breakdown = scoreHand(selected, scoreCtx(run));
  run.totalScore += breakdown.score;
  run.handsRemaining -= 1;
  removeFromHand(run, ids);
  draw(run, selected.length);

  const result: PlayResult = { playedCardIds: ids, breakdown };
  run.lastPlay = result;
  checkTransition(run, rng);
  return result;
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
    run.pendingReward = cashOutMoney(run.blindIndex, run.handsRemaining);
    run.money += run.pendingReward;
    run.status = "shop";
    run.shop = generateShop(run, rng);
  } else if (run.handsRemaining <= 0) {
    run.status = "lost_run";
  } else if (run.hand.length === 0 && run.deck.length === 0) {
    run.status = "lost_run"; // can no longer act
  }
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
