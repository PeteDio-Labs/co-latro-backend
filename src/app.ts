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
import { errorLogger, requestLogger } from "./middleware/logging.ts";
import { GameError } from "./engine.ts";
import { config } from "./config.ts";
import type { DB } from "./db/client.ts";

/** Options for tuning the app at construction (mainly for tests). */
export interface AppOptions {
  /** Override the per-IP login rate-limit max (defaults to config.loginRateLimitMax). */
  loginRateLimitMax?: number;
  /** PET-201: override the admin invites service (defaults to config.adminInvitesUrl / Auth). */
  adminInvitesUrl?: string;
  adminInvitesAuth?: string;
  /** PET-204: override the scoped invites Bearer token (defaults to config.adminInvitesToken). */
  adminInvitesToken?: string;
}

export function createApp(db: DB, options: AppOptions = {}): Application {
  const app = express();
  // PET-60: behind a proxy, trust X-Forwarded-For so req.ip is the real client (the login
  // rate-limiter keys on it). Configured via TRUST_PROXY; defaults to false (direct/local).
  app.set("trust proxy", config.trustProxy);
  app.use(express.json());
  // PET-65: log every request (excluding /health). Sits after the body parser so any logged
  // request id is stable, and BEFORE auth so anonymous/401 attempts are observable.
  app.use(requestLogger());

  app.get("/health", (_req, res) => {
    res.json({ status: "UP" });
  });

  // /api/auth/login is the only unauthenticated route; everything under /api/run requires a token.
  app.use("/api/auth", createAuthRouter(db, options));
  app.use("/api/decks", createBearerAuth(db), createDecksRouter());
  app.use("/api/run", createBearerAuth(db), createRunRouter(db));

  // 404 — Express 5 (path-to-regexp@8): use path-less middleware, not app.get("*").
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found", message: "Route not found" });
  });

  // Log thrown errors before the centralized handler responds (PET-65).
  app.use(errorLogger());

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
