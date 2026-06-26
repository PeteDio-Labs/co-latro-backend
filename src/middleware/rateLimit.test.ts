import { describe, expect, it } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "./rateLimit.ts";

/** Minimal Express req/res doubles for exercising the limiter without an HTTP server. */
function fakeReq(ip: string): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request;
}

/** Drive `mw` once and report whether next() was called and what (if anything) the response captured. */
function run(mw: (req: Request, res: Response, next: NextFunction) => void, ip: string) {
  let nexted = false;
  const captured = { status: null as number | null, headers: {} as Record<string, string>, body: undefined as unknown };
  const res = {
    setHeader(k: string, v: string) {
      captured.headers[k] = v;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(b: unknown) {
      captured.body = b;
      return this;
    },
  } as unknown as Response;
  mw(fakeReq(ip), res, () => {
    nexted = true;
  });
  return { nexted, ...captured };
}

describe("rateLimit", () => {
  it("allows up to `max` requests then 429s the rest within the window", () => {
    const mw = rateLimit({ max: 3, windowMs: 60_000 });
    expect(run(mw, "1.1.1.1").nexted).toBe(true);
    expect(run(mw, "1.1.1.1").nexted).toBe(true);
    expect(run(mw, "1.1.1.1").nexted).toBe(true);

    const fourth = run(mw, "1.1.1.1");
    expect(fourth.nexted).toBe(false);
    expect(fourth.status).toBe(429);
    expect((fourth.body as { error: string }).error).toBe("rate_limited");
    expect(fourth.headers["Retry-After"]).toBeTruthy();
  });

  it("buckets are per-IP — one IP's limit doesn't block another", () => {
    const mw = rateLimit({ max: 1, windowMs: 60_000 });
    expect(run(mw, "2.2.2.2").nexted).toBe(true);
    expect(run(mw, "2.2.2.2").nexted).toBe(false); // 2.2.2.2 now limited
    expect(run(mw, "3.3.3.3").nexted).toBe(true); // different IP, fresh bucket
  });

  it("resets after the window elapses", async () => {
    const mw = rateLimit({ max: 1, windowMs: 20 });
    expect(run(mw, "4.4.4.4").nexted).toBe(true);
    expect(run(mw, "4.4.4.4").nexted).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(run(mw, "4.4.4.4").nexted).toBe(true); // window rolled over
  });

  it("each limiter instance owns an independent store", () => {
    const a = rateLimit({ max: 1, windowMs: 60_000 });
    const b = rateLimit({ max: 1, windowMs: 60_000 });
    expect(run(a, "5.5.5.5").nexted).toBe(true);
    expect(run(a, "5.5.5.5").nexted).toBe(false); // a is limited
    expect(run(b, "5.5.5.5").nexted).toBe(true); // b is independent
  });
});
