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

/**
 * PET-201: validate + atomically consume an invite via the co-latro-admin `invites` function
 * (POST {base}/validate {code, user}). Returns ok:true only when the admin claimed the code.
 * Maps the admin's already-used (409) / expired (410) / unknown (404) into player-facing
 * messages, and FAILS CLOSED on any transport error — a configured gate must not let people in
 * when the validator is unreachable. `auth` is the faasd gateway basic-auth ("user:pass"), optional.
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
    // PET-204 (F2): prefer the scoped invites Bearer token (the function's own authz). Fall back
    // to the legacy gateway basic-auth only when no token is configured (interim / back-compat).
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
  /** Override the per-IP login rate-limit max (defaults to config.loginRateLimitMax). */
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

  // PET-201: invite gate, resolved once at router construction. Options override config (tests).
  // Invites are issued + validated by the co-latro-admin `invites` function; the gate is OFF
  // when adminInvitesUrl is empty (dev, and the interim before that fn is deployed — PET-99) —
  // the site stays edge-gated by Cloudflare Access regardless.
  const adminInvitesUrl = options.adminInvitesUrl ?? config.adminInvitesUrl;
  const adminInvitesAuth = options.adminInvitesAuth ?? config.adminInvitesAuth;
  const adminInvitesToken = options.adminInvitesToken ?? config.adminInvitesToken;
  const inviteGateOn = adminInvitesUrl !== "";

  // PET-203 (F8): fail CLOSED on a config footgun. An unset COLATRO_ADMIN_INVITES_URL silently
  // disables the gate (open public signup) with only Cloudflare Access left — and the origin is
  // LAN-reachable past the edge. In production we refuse to boot rather than come up wide open;
  // an operator who genuinely wants open signup (the PET-99 interim) must opt in explicitly.
  // `options.adminInvitesUrl !== undefined` exempts tests, which construct the app directly.
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
    // PET-203 (F11): reject control characters (incl. NUL / CR / LF). Names are stored, echoed to
    // other surfaces (admin `used_by`, structured logs), and rendered — control chars enable log
    // injection / display spoofing. Printable text (letters, digits, spaces, punctuation, emoji,
    // CJK) is allowed; the frontend escapes on render as defense-in-depth.
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F\x7F]/.test(name)) {
      res.status(400).json({ error: "invalid_name", message: "Name contains invalid characters" });
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
      // PET-201: a NEW account needs a valid invite when the gate is on (existing users above
      // are never gated). Rate-limited upstream (PET-60); the edge gate is Cloudflare Access
      // (PET-58) — this is the app-level half.
      const code =
        inviteGateOn && typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
      if (inviteGateOn && !code) {
        res.status(403).json({
          error: "invite_required",
          message: "This prealpha is invite-only — enter your invite code.",
        });
        return;
      }
      // PET-203 (F5): create the row FIRST, then consume the invite — the local insert is reliable
      // while the remote claim is the failure-prone step. The previous order (consume → insert)
      // burned the single-use code with no rollback if the insert failed (the admin only un-claims
      // on expiry), self-DoSing the invite. Now: if the claim is rejected we delete the just-created
      // row, so a bad/used code leaves nothing behind, and a successful claim is the LAST thing that
      // can fail — nothing after it can orphan a consumed code.
      const id = crypto.randomUUID();
      await db.insert(users).values({ id, name, tokenHash, tokenExpiresAt });
      if (inviteGateOn) {
        const verdict = await validateInvite(adminInvitesUrl, adminInvitesAuth, adminInvitesToken, code, name);
        if (!verdict.ok) {
          await db.delete(users).where(eq(users.id, id)); // roll back the un-invited account
          res.status(403).json({ error: "invite_required", message: verdict.message });
          return;
        }
      }
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
