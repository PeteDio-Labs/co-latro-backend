/** Auth routes (PET-206): invite-gated signup (username + password) + password login.
 *  Replaces the old name-only find-or-create — accounts now carry an argon2id password, so
 *  knowing a username is no longer enough to play as that user (closes PET-203/F3). */

import { eq } from "drizzle-orm";
import { Router } from "express";
import type { DB } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { config } from "../config.ts";
import { TOKEN_TTL_SECONDS, createBearerAuth, sha256hex } from "../middleware/auth.ts";
import { loginRateLimit } from "../middleware/rateLimit.ts";

/** PET-60/206: usernames are bounded — empty/whitespace and >40 chars are rejected. */
const MAX_NAME_LENGTH = 40;
/** PET-206: password bounds. Min for strength; max so a giant input can't tie up argon2 (DoS). */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** PET-206: argon2id at rest (Bun's built-in). The raw password is never stored or logged. */
function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false; // malformed hash → treat as mismatch
  }
}

// PET-206: a real argon2id hash to verify against when the username doesn't exist, so a login
// miss costs the same as a wrong password — no timing oracle that reveals which usernames exist.
// Computed once, lazily (top-level await would block module import for every consumer).
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  return (dummyHashPromise ??= hashPassword("timing-equalizer-not-a-real-secret"));
}

/** Validate a submitted username → trimmed value, or a 400-shaped error. */
function checkUsername(raw: unknown): { name: string } | { error: string; message: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { error: "invalid_username", message: "Enter a username" };
  }
  const name = raw.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return { error: "invalid_username", message: `Username must be ${MAX_NAME_LENGTH} characters or fewer` };
  }
  // PET-203/F11: reject control characters (log injection / display spoofing once echoed).
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(name)) {
    return { error: "invalid_username", message: "Username contains invalid characters" };
  }
  return { name };
}

/** Validate a submitted password (not trimmed — leading/trailing spaces are significant). */
function checkPassword(raw: unknown): { password: string } | { error: string; message: string } {
  if (typeof raw !== "string" || raw.length < MIN_PASSWORD_LENGTH) {
    return { error: "invalid_password", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return { error: "invalid_password", message: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer` };
  }
  return { password: raw };
}

/**
 * PET-201: validate + atomically consume an invite via the co-latro-admin `invites` function
 * (POST {base}/validate {code, user}). Returns ok:true only when the admin claimed the code.
 * Maps already-used (409) / expired (410) / unknown (404) into player-facing messages, and FAILS
 * CLOSED on any transport error. PET-204 (F2): authenticates with the scoped Bearer `token`
 * (preferred) or the legacy gateway basic-auth (`auth`, back-compat fallback).
 */
async function validateInvite(
  baseUrl: string,
  auth: string,
  token: string,
  code: string,
  user: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    else if (auth) headers.authorization = "Basic " + Buffer.from(auth).toString("base64");
    const r = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ code, user }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (r.ok && body.ok) return { ok: true, message: "" };
    const message =
      body.error === "already used" ? "That invite code has already been used."
        : body.error === "expired" ? "That invite code has expired."
          : body.error === "unknown code" ? "That invite code isn't valid."
            : "Invalid invite code.";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Couldn't verify your invite right now — please try again shortly." };
  }
}

/** Auth-router knobs (forwarded from createApp; mainly for tests). */
export interface AuthRouterOptions {
  /** Override the per-IP login/signup rate-limit max (defaults to config.loginRateLimitMax). */
  loginRateLimitMax?: number;
  /** PET-201: override the admin invites service (defaults to config.adminInvitesUrl / Auth). */
  adminInvitesUrl?: string;
  adminInvitesAuth?: string;
  /** PET-204: override the scoped invites Bearer token (defaults to config.adminInvitesToken). */
  adminInvitesToken?: string;
}

export function createAuthRouter(db: DB, options: AuthRouterOptions = {}): Router {
  const router = Router();
  const bearerAuth = createBearerAuth(db);

  // PET-201: invite gate, resolved once at construction. The gate is OFF when adminInvitesUrl is
  // empty (dev / the interim before the admin fn is deployed) — the site stays edge-gated by CF.
  const adminInvitesUrl = options.adminInvitesUrl ?? config.adminInvitesUrl;
  const adminInvitesAuth = options.adminInvitesAuth ?? config.adminInvitesAuth;
  const adminInvitesToken = options.adminInvitesToken ?? config.adminInvitesToken;
  const inviteGateOn = adminInvitesUrl !== "";

  // PET-203 (F8): fail CLOSED on the config footgun — refuse to boot in production with the invite
  // gate unconfigured (would be open public signup). An operator who genuinely wants open signup
  // sets COLATRO_ALLOW_OPEN_SIGNUP=1. `options.adminInvitesUrl !== undefined` exempts tests.
  if (
    config.env === "production" &&
    !inviteGateOn &&
    options.adminInvitesUrl === undefined &&
    process.env.COLATRO_ALLOW_OPEN_SIGNUP !== "1"
  ) {
    throw new Error(
      "Refusing to start: invite gate is OFF in production (COLATRO_ADMIN_INVITES_URL is empty). " +
        "Configure the admin invites service, or set COLATRO_ALLOW_OPEN_SIGNUP=1 to allow open signup deliberately.",
    );
  }

  /** Mint a fresh token: raw token (returned once) + its stored hash + expiry. */
  function mintToken(): { token: string; tokenHash: string; tokenExpiresAt: number } {
    const token = generateToken();
    return { token, tokenHash: sha256hex(token), tokenExpiresAt: nowSec() + TOKEN_TTL_SECONDS };
  }

  // PET-206: create a credentialed account. Needs a valid invite when the gate is on. Per-IP
  // rate-limited (PET-60) to blunt enumeration. Edge gate is Cloudflare Access (PET-58).
  router.post("/signup", loginRateLimit(options.loginRateLimitMax), async (req, res) => {
    const u = checkUsername(req.body?.username);
    if ("error" in u) {
      res.status(400).json(u);
      return;
    }
    const p = checkPassword(req.body?.password);
    if ("error" in p) {
      res.status(400).json(p);
      return;
    }
    const { name } = u;

    let code = "";
    if (inviteGateOn) {
      code = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
      if (!code) {
        res.status(403).json({
          error: "invite_required",
          message: "This prealpha is invite-only — enter your invite code.",
        });
        return;
      }
    }

    // Reject a taken username up front with a clear 409 (the unique index is the real guard).
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.name, name)).limit(1);
    if (existing) {
      res.status(409).json({ error: "username_taken", message: "That username is taken — choose another." });
      return;
    }

    const passwordHash = await hashPassword(p.password);
    const { token, tokenHash, tokenExpiresAt } = mintToken();
    const id = crypto.randomUUID();

    // PET-203 (F5): create the row first (settles the unique name), consume the invite LAST, and
    // roll the row back if the claim is rejected — so a bad/used code never burns with an orphaned
    // account, and a successful claim is the last thing that can fail.
    try {
      await db.insert(users).values({ id, name, passwordHash, tokenHash, tokenExpiresAt });
    } catch {
      res.status(409).json({ error: "username_taken", message: "That username is taken — choose another." });
      return;
    }
    if (inviteGateOn) {
      const verdict = await validateInvite(adminInvitesUrl, adminInvitesAuth, adminInvitesToken, code, name);
      if (!verdict.ok) {
        await db.delete(users).where(eq(users.id, id));
        res.status(403).json({ error: "invite_required", message: verdict.message });
        return;
      }
    }
    res.status(201).json({ token, user: { id, name } });
  });

  // PET-206: password login. No find-or-create, no invite — the account must already exist and
  // the password must match. A miss and a wrong password are indistinguishable (same 401, same
  // argon2 cost via the dummy hash) so usernames can't be enumerated. Per-IP rate-limited.
  router.post("/login", loginRateLimit(options.loginRateLimitMax), async (req, res) => {
    const name = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!name || !password) {
      res.status(400).json({ error: "invalid_credentials", message: "Enter your username and password" });
      return;
    }

    const [row] = await db
      .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.name, name))
      .limit(1);
    const ok = await verifyPassword(password, row?.passwordHash ?? (await dummyHash()));
    if (!row || !ok) {
      res.status(401).json({ error: "invalid_credentials", message: "Incorrect username or password" });
      return;
    }

    const { token, tokenHash, tokenExpiresAt } = await mintToken();
    await db.update(users).set({ tokenHash, tokenExpiresAt, lastSeenAt: nowSec() }).where(eq(users.id, row.id));
    res.status(200).json({ token, user: { id: row.id, name: row.name } });
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
