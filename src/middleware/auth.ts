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

/** PET-60: tokens expire 30 days after they're minted; a 401 then forces a re-login. */
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function sha256hex(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export function createBearerAuth(db: DB) {
  return async function bearerAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const match = (req.header("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: "missing_bearer_token", message: "Sign in to play" });
      return;
    }
    const hash = sha256hex(match[1]!.trim());
    const rows = await db
      .select({ id: users.id, tokenExpiresAt: users.tokenExpiresAt })
      .from(users)
      .where(eq(users.tokenHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: "invalid_token", message: "Session expired — sign in again" });
      return;
    }
    // PET-60: an expired token is treated exactly like an invalid one — re-login required.
    // (tokenExpiresAt is nullable for rows that predate this column / have no live token.)
    const now = Math.floor(Date.now() / 1000);
    if (row.tokenExpiresAt != null && row.tokenExpiresAt <= now) {
      res.status(401).json({ error: "token_expired", message: "Session expired — sign in again" });
      return;
    }
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, row.id));
    req.userId = row.id;
    next();
  };
}
