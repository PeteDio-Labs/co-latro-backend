/** Bearer-token auth: resolve req.userId from an opaque token (sha256-hashed) in the DB. */

import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import type { DB } from "../db/client.ts";
import { users } from "../db/schema.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function sha256hex(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export function createBearerAuth(db: DB) {
  return function bearerAuth(req: Request, res: Response, next: NextFunction): void {
    const match = (req.header("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: "missing_bearer_token", message: "Sign in to play" });
      return;
    }
    const hash = sha256hex(match[1]!.trim());
    const row = db.select({ id: users.id }).from(users).where(eq(users.tokenHash, hash)).get();
    if (!row) {
      res.status(401).json({ error: "invalid_token", message: "Session expired — sign in again" });
      return;
    }
    db.update(users)
      .set({ lastSeenAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, row.id))
      .run();
    req.userId = row.id;
    next();
  };
}
