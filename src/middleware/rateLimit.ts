/**
 * PET-60 — tiny in-memory, per-IP rate limiter. A brute-force guard for the only unauthenticated
 * route (`/api/auth/login`): a fixed window of `max` requests per `windowMs` keyed on the client IP.
 *
 * Deliberately dependency-free and single-process. The homelab/AWS-shape deploy runs one backend
 * instance, so a shared store (Redis) isn't warranted yet; if the service is ever horizontally
 * scaled this should move to a shared backing store. Expired windows are swept lazily on access plus
 * a low-frequency timer, so memory stays bounded under sustained traffic.
 */

import type { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";

interface Window {
  count: number;
  resetAt: number; // epoch ms when the current window rolls over
}

export interface RateLimitOptions {
  /** Max requests allowed per IP within the window. */
  max?: number;
  /** Window length in milliseconds. */
  windowMs?: number;
}

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

/** Best-effort client IP: trust Express's req.ip (honours trust proxy), fall back to the socket. */
function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Build a per-IP fixed-window limiter. Each returned middleware owns its own store, so distinct
 * routes don't share buckets. Returns 429 with a machine code + `Retry-After` when over the limit.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const buckets = new Map<string, Window>();

  // Periodic sweep so a churn of one-shot IPs can't grow the map unboundedly. Unref'd so it never
  // keeps the process (or a test runner) alive.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, w] of buckets) if (w.resetAt <= now) buckets.delete(ip);
  }, windowMs);
  (sweep as { unref?: () => void }).unref?.();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const ip = clientIp(req);
    let w = buckets.get(ip);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, w);
    }
    w.count += 1;

    if (w.count > max) {
      const retryAfter = Math.max(1, Math.ceil((w.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "rate_limited",
        message: "Too many attempts — please wait a moment and try again",
      });
      return;
    }
    next();
  };
}

/**
 * The login limiter: ~10 attempts/minute/IP by default (PET-60 brute-force guard). `max` comes from
 * config (LOGIN_RATE_LIMIT_MAX) so the value is one knob; callers may override for tests.
 */
export function loginRateLimit(max?: number) {
  return rateLimit({ max: max ?? config.loginRateLimitMax, windowMs: 60_000 });
}
