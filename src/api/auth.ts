/** Auth routes: sign in by name (find-or-create, issue token) + resolve current user. */

import { eq } from "drizzle-orm";
import { Router } from "express";
import type { DB } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { config } from "../config.ts";
import { TOKEN_TTL_SECONDS, createBearerAuth, sha256hex } from "../middleware/auth.ts";
import { loginRateLimit } from "../middleware/rateLimit.ts";

/** PET-60: display names are bounded — empty/whitespace and >40 chars are rejected (not silently truncated). */
const MAX_NAME_LENGTH = 40;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Auth-router knobs (forwarded from createApp; mainly for tests). */
export interface AuthRouterOptions {
  /** Override the per-IP login rate-limit max (defaults to config.loginRateLimitMax). */
  loginRateLimitMax?: number;
  /** PET-59: override the invite gate (defaults to config.inviteCode / config.inviteAllowlist). */
  inviteCode?: string;
  inviteAllowlist?: string[];
}

export function createAuthRouter(db: DB, options: AuthRouterOptions = {}): Router {
  const router = Router();
  const bearerAuth = createBearerAuth(db);

  // PET-59: invite gate, resolved once at router construction. Options override config (tests).
  // The gate is OFF unless a code or a non-empty allowlist is configured.
  const inviteCode = options.inviteCode ?? config.inviteCode;
  const inviteAllowlist = options.inviteAllowlist ?? config.inviteAllowlist;
  const inviteGateOn = inviteCode !== "" || inviteAllowlist.length > 0;

  // Sign in by name: find-or-create the user, mint a fresh token (returned exactly once).
  // Per-IP rate-limited (PET-60) to blunt brute-force / enumeration before it reaches the DB.
  router.post("/login", loginRateLimit(options.loginRateLimitMax), async (req, res) => {
    const rawName = req.body?.name;
    if (typeof rawName !== "string" || !rawName.trim()) {
      res.status(400).json({ error: "invalid_name", message: "Enter a name" });
      return;
    }
    const name = rawName.trim();
    // PET-60: reject over-long names with a clear error instead of truncating them.
    if (name.length > MAX_NAME_LENGTH) {
      res.status(400).json({
        error: "invalid_name",
        message: `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
      });
      return;
    }
    const token = generateToken();
    const tokenHash = sha256hex(token);
    const tokenExpiresAt = nowSec() + TOKEN_TTL_SECONDS;

    const [existing] = await db.select().from(users).where(eq(users.name, name)).limit(1);
    let user: { id: string; name: string };
    if (existing) {
      await db
        .update(users)
        .set({ tokenHash, tokenExpiresAt, lastSeenAt: nowSec() })
        .where(eq(users.id, existing.id));
      user = { id: existing.id, name: existing.name };
    } else {
      // PET-59: a NEW account needs an invite when the gate is on (existing users above are
      // never gated). Allowed by an allowlist entry (case-insensitive) or a matching shared
      // code in the request body. Rate-limited upstream (PET-60); the real edge gate is
      // Cloudflare Access (PET-58) — this is the app-level half.
      if (inviteGateOn) {
        const rawCode = req.body?.inviteCode;
        const allowed =
          inviteAllowlist.includes(name.toLowerCase()) ||
          (inviteCode !== "" && typeof rawCode === "string" && rawCode === inviteCode);
        if (!allowed) {
          res.status(403).json({
            error: "invite_required",
            message: "This prealpha is invite-only — enter a valid invite code.",
          });
          return;
        }
      }
      const id = crypto.randomUUID();
      await db.insert(users).values({ id, name, tokenHash, tokenExpiresAt });
      user = { id, name };
    }
    res.status(201).json({ token, user });
  });

  // Sign out: invalidate the current token server-side by rotating the hash to an unguessable,
  // already-expired value (the unique tokenHash column forbids NULL/duplicate, so we don't clear it).
  router.post("/logout", bearerAuth, async (req, res) => {
    await db
      .update(users)
      .set({ tokenHash: sha256hex(generateToken()), tokenExpiresAt: nowSec() - 1 })
      .where(eq(users.id, req.userId!));
    res.status(204).end();
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
