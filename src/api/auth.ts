/** Auth routes: sign in by name (find-or-create, issue token) + resolve current user. */

import { eq } from "drizzle-orm";
import { Router } from "express";
import type { DB } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { createBearerAuth, sha256hex } from "../middleware/auth.ts";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function createAuthRouter(db: DB): Router {
  const router = Router();
  const bearerAuth = createBearerAuth(db);

  // Sign in by name: find-or-create the user, mint a fresh token (returned exactly once).
  router.post("/login", async (req, res) => {
    const rawName = req.body?.name;
    if (typeof rawName !== "string" || !rawName.trim()) {
      res.status(400).json({ error: "invalid_name", message: "Enter a name" });
      return;
    }
    const name = rawName.trim().slice(0, 40);
    const token = generateToken();
    const tokenHash = sha256hex(token);

    const [existing] = await db.select().from(users).where(eq(users.name, name)).limit(1);
    let user: { id: string; name: string };
    if (existing) {
      await db
        .update(users)
        .set({ tokenHash, lastSeenAt: nowSec() })
        .where(eq(users.id, existing.id));
      user = { id: existing.id, name: existing.name };
    } else {
      const id = crypto.randomUUID();
      await db.insert(users).values({ id, name, tokenHash });
      user = { id, name };
    }
    res.status(201).json({ token, user });
  });

  // Resolve the current user from the Bearer token.
  router.get("/me", bearerAuth, async (req, res) => {
    const [row] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);
    if (!row) {
      res.status(401).json({ error: "invalid_token", message: "Sign in again" });
      return;
    }
    res.json({ user: row });
  });

  return router;
}
