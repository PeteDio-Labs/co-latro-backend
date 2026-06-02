/** Express app factory. DB is injected so tests can supply an in-memory one. */

import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createAuthRouter } from "./api/auth.ts";
import { createDecksRouter } from "./api/decks.ts";
import { createRunRouter } from "./api/run.ts";
import { createBearerAuth } from "./middleware/auth.ts";
import { GameError } from "./engine.ts";
import type { DB } from "./db/client.ts";

export function createApp(db: DB): Application {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "UP" });
  });

  // /api/auth/login is the only unauthenticated route; everything under /api/run requires a token.
  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/decks", createBearerAuth(db), createDecksRouter());
  app.use("/api/run", createBearerAuth(db), createRunRouter(db));

  // 404 — Express 5 (path-to-regexp@8): use path-less middleware, not app.get("*").
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found", message: "Route not found" });
  });

  // Centralized error handler. GameError carries its own HTTP status + machine code.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GameError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "internal_error", message: "Something went wrong" });
  });

  return app;
}
