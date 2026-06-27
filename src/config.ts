/** Runtime configuration, read once at boot. */

// Postgres connection string. In prod this comes from the environment (sourced from
// Vault `kv/poker/db` by the deploy tooling); locally it defaults to a dev Postgres.
const defaultDatabaseUrl = "postgres://postgres:postgres@localhost:5432/colatro";

// PET-60: when the backend sits behind a reverse proxy (Cloudflare tunnel → nginx in the homelab),
// Express must "trust proxy" to resolve the real client IP from X-Forwarded-For — otherwise the
// per-IP login rate-limiter sees only the proxy's IP and collapses to one global bucket. Set
// TRUST_PROXY to the number of trusted hops in front of the app (e.g. "1"), or a comma-separated
// list of trusted proxy IPs/subnets. Leave unset in local dev. See Express "trust proxy" docs.
function parseTrustProxy(raw: string | undefined): boolean | number | string[] {
  if (raw == null || raw === "") return false;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// PET-59: prealpha invite gate on NEW account creation (existing users always resolve). The
// gate is OFF when neither knob is set (local/dev keep working), and ON as soon as either is
// configured: a new name then needs an allowlist entry OR a matching invite code. Sourced from
// the environment (Vault kv/poker/* via the deploy tooling), like DATABASE_URL. Names are
// compared case-insensitively, so the allowlist is normalized to lowercase here.
function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 3020,
  env: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // PET-60: per-IP login attempts allowed per minute (brute-force guard). Overridable so the test
  // suite — which logs in many users from one loopback IP — isn't throttled.
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  // PET-59: invite gate (see parseAllowlist). Empty code + empty allowlist = gate off.
  inviteCode: process.env.COLATRO_INVITE_CODE ?? "",
  inviteAllowlist: parseAllowlist(process.env.COLATRO_INVITE_ALLOWLIST),
} as const;
