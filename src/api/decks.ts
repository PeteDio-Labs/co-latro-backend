/** Preset deck catalog (static reference data). Bearer-authed for consistency, but no per-user data. */

import { Router } from "express";
import { listDecks } from "../engine.ts";

export function createDecksRouter(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({ decks: listDecks() });
  });
  return router;
}
