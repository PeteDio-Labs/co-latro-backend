/** Run routes (all Bearer-authed). DB-authoritative: load by req.userId → transition → save. */

import { Router } from "express";
import type { DB } from "../db/client.ts";
import { isDifficulty } from "../difficulty.ts";
import {
  GameError,
  buyItem,
  continueRun,
  discardCards,
  getDeck,
  groupComposition,
  groupRemaining,
  moveJoker,
  playHand,
  previewSelection,
  rerollShop,
  sellJoker,
  startBlind,
  startRun,
  toRunDTO,
  type RunState,
} from "../engine.ts";
import { deleteActiveRuns, getActiveRun, insertRun, saveRun } from "../db/sessions.ts";
import type { ScoreBreakdown } from "../scoring.ts";

export function createRunRouter(db: DB): Router {
  const router = Router();

  // Resume: latest non-terminal run, or null.
  router.get("/active", (req, res) => {
    const run = getActiveRun(db, req.userId!);
    res.json({ run: run ? toRunDTO(run) : null });
  });

  // Start a NEW run — overwrites the active save (Balatro-style). Resume uses GET /active + "Continue Run".
  router.post("/", (req, res) => {
    const difficulty = req.body?.difficulty;
    if (!isDifficulty(difficulty)) {
      throw new GameError(400, "invalid_difficulty", "difficulty must be easy, medium, or hard");
    }
    const deckId = typeof req.body?.deckId === "string" ? req.body.deckId : undefined;
    if (deckId !== undefined) getDeck(deckId); // validate BEFORE deleting (a bad deck must not destroy the save)
    deleteActiveRuns(db, req.userId!); // overwrite any in-progress run
    const run = startRun(difficulty, req.userId!, deckId);
    insertRun(db, run);
    res.status(201).json(toRunDTO(run));
  });

  // Discard the active run so a fresh one can start.
  router.post("/abandon", (req, res) => {
    const run = getActiveRun(db, req.userId!);
    if (run) {
      run.status = "lost_run";
      saveRun(db, run);
    }
    res.json({ run: null });
  });

  router.post("/blind", (req, res) => {
    const run = requireActive(db, req.userId!);
    startBlind(run);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/play", (req, res) => {
    const run = requireActive(db, req.userId!);
    playHand(run, req.body?.selectedCardIds);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/discard", (req, res) => {
    const run = requireActive(db, req.userId!);
    discardCards(run, req.body?.selectedCardIds);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/preview", (req, res) => {
    const run = requireActive(db, req.userId!);
    const ids = req.body?.selectedCardIds;
    let preview: ScoreBreakdown | null = null;
    if (run.status === "playing" && Array.isArray(ids) && ids.length > 0) {
      preview = previewSelection(run, ids);
    }
    res.json({ ...toRunDTO(run), preview });
  });

  // Shop: buy a planet (levels a hand) / reroll the offerings.
  router.post("/buy", (req, res) => {
    const run = requireActive(db, req.userId!);
    buyItem(run, req.body?.itemId);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/reroll", (req, res) => {
    const run = requireActive(db, req.userId!);
    rerollShop(run);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Sell a joker (half refund) / reorder jokers (order affects scoring).
  router.post("/sell", (req, res) => {
    const run = requireActive(db, req.userId!);
    sellJoker(run, req.body?.jokerId);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/reorder", (req, res) => {
    const run = requireActive(db, req.userId!);
    moveJoker(run, req.body?.jokerId, req.body?.dir);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/continue", (req, res) => {
    const run = requireActive(db, req.userId!);
    continueRun(run);
    saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Deck peek — grouped counts only (sorted), so draw order is never revealed.
  router.get("/deck", (req, res) => {
    const run = requireActive(db, req.userId!);
    res.json({ remaining: groupRemaining(run), composition: groupComposition(run) });
  });

  return router;
}

function requireActive(db: DB, userId: string): RunState {
  const run = getActiveRun(db, userId);
  if (!run) {
    throw new GameError(404, "no_active_run", "No active run");
  }
  return run;
}
