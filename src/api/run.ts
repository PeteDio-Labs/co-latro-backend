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
  pickFromPack,
  playHand,
  previewSelection,
  rerollShop,
  sellConsumable,
  sellJoker,
  skipBlind,
  skipPack,
  startBlind,
  startRun,
  toRunDTO,
  useConsumable,
  type RunState,
} from "../engine.ts";
import { deleteActiveRuns, getActiveRun, insertRun, saveRun } from "../db/sessions.ts";
import type { ScoreBreakdown } from "../scoring.ts";

export function createRunRouter(db: DB): Router {
  const router = Router();

  // Resume: latest non-terminal run, or null.
  router.get("/active", async (req, res) => {
    const run = await getActiveRun(db, req.userId!);
    res.json({ run: run ? toRunDTO(run) : null });
  });

  // Start a NEW run — overwrites the active save (Balatro-style). Resume uses GET /active + "Continue Run".
  router.post("/", async (req, res) => {
    const difficulty = req.body?.difficulty;
    if (!isDifficulty(difficulty)) {
      throw new GameError(400, "invalid_difficulty", "difficulty must be easy, medium, or hard");
    }
    const deckId = typeof req.body?.deckId === "string" ? req.body.deckId : undefined;
    if (deckId !== undefined) getDeck(deckId); // validate BEFORE deleting (a bad deck must not destroy the save)
    await deleteActiveRuns(db, req.userId!); // overwrite any in-progress run
    const run = startRun(difficulty, req.userId!, deckId);
    await insertRun(db, run);
    res.status(201).json(toRunDTO(run));
  });

  // Discard the active run so a fresh one can start.
  router.post("/abandon", async (req, res) => {
    const run = await getActiveRun(db, req.userId!);
    if (run) {
      run.status = "lost_run";
      await saveRun(db, run);
    }
    res.json({ run: null });
  });

  router.post("/blind", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    startBlind(run);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/play", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    playHand(run, req.body?.selectedCardIds);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/discard", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    discardCards(run, req.body?.selectedCardIds);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/preview", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    const ids = req.body?.selectedCardIds;
    let preview: ScoreBreakdown | null = null;
    if (run.status === "playing" && Array.isArray(ids) && ids.length > 0) {
      preview = previewSelection(run, ids);
    }
    res.json({ ...toRunDTO(run), preview });
  });

  // Shop: buy a planet (levels a hand) / reroll the offerings.
  router.post("/buy", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    buyItem(run, req.body?.itemId);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/reroll", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    rerollShop(run);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Sell a joker (half refund) / reorder jokers (order affects scoring).
  router.post("/sell", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    sellJoker(run, req.body?.jokerId);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/reorder", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    moveJoker(run, req.body?.jokerId, req.body?.dir);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/continue", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    continueRun(run);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Consumables: use / sell. Skeleton routes — content streams (PET-71/72) wire the effects.
  router.post("/consumable/use", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    useConsumable(run, req.body?.instanceId, req.body?.selectedCardIds);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/consumable/sell", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    sellConsumable(run, req.body?.instanceId);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Skip the upcoming blind (small/big only). Tag-reward payout lands with PET-83.
  router.post("/skip", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    skipBlind(run);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Booster packs: pick N-of-M offered items, or skip the rest.
  router.post("/pack/pick", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    pickFromPack(run, req.body?.itemIds);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  router.post("/pack/skip", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    skipPack(run);
    await saveRun(db, run);
    res.json(toRunDTO(run));
  });

  // Deck peek — grouped counts only (sorted), so draw order is never revealed.
  router.get("/deck", async (req, res) => {
    const run = await requireActive(db, req.userId!);
    res.json({ remaining: groupRemaining(run), composition: groupComposition(run) });
  });

  return router;
}

async function requireActive(db: DB, userId: string): Promise<RunState> {
  const run = await getActiveRun(db, userId);
  if (!run) {
    throw new GameError(404, "no_active_run", "No active run");
  }
  return run;
}
