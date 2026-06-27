import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Server } from "node:http";
import { createApp } from "../app.ts";
import type { DB } from "../db/client.ts";
import { freshDb } from "../db/testdb.ts";
import { users } from "../db/schema.ts";

let server: Server;
let base: string;
let db: DB;

beforeAll(async () => {
  db = await freshDb(); // migrated + truncated Postgres
  // This suite logs in many users from one loopback IP — lift the per-IP login cap so the
  // brute-force limiter (exercised separately below) doesn't throttle unrelated cases.
  server = createApp(db, { loginRateLimitMax: 10_000 }).listen(0) as unknown as Server;
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://localhost:${port}`;
});

afterAll(() => server.close());

function authed(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function login(name: string): Promise<string> {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(r.status).toBe(201);
  const body = (await r.json()) as { token: string };
  return body.token;
}

describe("auth", () => {
  it("login returns token + user", async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alice" }),
    });
    expect(r.status).toBe(201);
    const body = (await r.json()) as { token: string; user: { name: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.name).toBe("Alice");
  });

  it("me works with a token; 401 without or with a bad one", async () => {
    const token = await login("Bob");
    const ok = await fetch(`${base}/api/auth/me`, { headers: authed(token) });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { user: { name: string } }).user.name).toBe("Bob");

    expect((await fetch(`${base}/api/auth/me`)).status).toBe(401);
    expect((await fetch(`${base}/api/auth/me`, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("login is find-or-create (same name → same user); re-login rotates the token", async () => {
    const t1 = await login("Carol");
    const u1 = (await (await fetch(`${base}/api/auth/me`, { headers: authed(t1) })).json()) as { user: { id: string } };
    const t2 = await login("Carol"); // re-login rotates the token, invalidating t1
    const u2 = (await (await fetch(`${base}/api/auth/me`, { headers: authed(t2) })).json()) as { user: { id: string } };
    expect(u2.user.id).toBe(u1.user.id); // same user
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t1) })).status).toBe(401); // old token dead
  });

  // PET-60: name validation — empty/whitespace and >40 chars are rejected (not silently truncated).
  it("rejects empty / whitespace-only / missing names with 400 invalid_name", async () => {
    for (const body of [{ name: "" }, { name: "   " }, { name: 123 }, {}]) {
      const r = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toBe("invalid_name");
    }
  });

  it("rejects names longer than 40 chars with 400 (no silent truncation)", async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(41) }),
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe("invalid_name");
    // and the over-long name was NOT created
    const rows = await db.select().from(users).where(eq(users.name, "x".repeat(40)));
    expect(rows.length).toBe(0);
  });

  it("accepts a name of exactly 40 chars (boundary)", async () => {
    const name = "y".repeat(40);
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { user: { name: string } }).user.name).toBe(name);
  });

  // PET-60: logout invalidates the current token server-side.
  it("logout invalidates the token (204; old token then 401), and a fresh login works", async () => {
    const t = await login("Quinn");
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t) })).status).toBe(200);

    const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: authed(t) });
    expect(out.status).toBe(204);

    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t) })).status).toBe(401); // token dead
    expect((await fetch(`${base}/api/auth/logout`, { method: "POST", headers: authed(t) })).status).toBe(401);

    const t2 = await login("Quinn"); // can sign back in
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t2) })).status).toBe(200);
  });

  // PET-60: an expired token is rejected like an invalid one.
  it("rejects an expired token with 401 token_expired", async () => {
    const t = await login("Rex");
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t) })).status).toBe(200);

    // Force the token into the past directly in the DB.
    await db
      .update(users)
      .set({ tokenExpiresAt: Math.floor(Date.now() / 1000) - 10 })
      .where(eq(users.name, "Rex"));

    const r = await fetch(`${base}/api/auth/me`, { headers: authed(t) });
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe("token_expired");
    // expiry also gates the rest of the API, not just /me
    expect((await fetch(`${base}/api/run/active`, { headers: authed(t) })).status).toBe(401);
  });

  it("login sets a future token expiry (~30 days out)", async () => {
    await login("Sky");
    const [row] = await db
      .select({ exp: users.tokenExpiresAt })
      .from(users)
      .where(eq(users.name, "Sky"))
      .limit(1);
    const now = Math.floor(Date.now() / 1000);
    expect(row!.exp).not.toBeNull();
    expect(row!.exp!).toBeGreaterThan(now + 29 * 24 * 60 * 60);
    expect(row!.exp!).toBeLessThanOrEqual(now + 30 * 24 * 60 * 60 + 5);
  });
});

describe("run", () => {
  it("requires auth", async () => {
    expect((await fetch(`${base}/api/run/active`)).status).toBe(401);
  });

  it("fresh user has no active run", async () => {
    const token = await login("Dave");
    const r = await fetch(`${base}/api/run/active`, { headers: authed(token) });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { run: unknown }).run).toBeNull();
  });

  it("start → blind → playing, and never leaks the deck", async () => {
    const token = await login("Erin");
    const start = await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium" }),
    });
    expect(start.status).toBe(201);
    const startText = await start.text();
    expect(startText).not.toContain('"deck"');
    expect(startText).not.toContain('"deckComposition"');
    expect((JSON.parse(startText) as { status: string }).status).toBe("selecting_blind");

    const blind = await fetch(`${base}/api/run/blind`, { method: "POST", headers: authed(token) });
    expect(blind.status).toBe(200);
    const blindText = await blind.text();
    expect(blindText).not.toContain('"deck"');
    expect(blindText).not.toContain('"deckComposition"');
    const run = JSON.parse(blindText) as { status: string; handSize: number; deckRemaining: number; target: number };
    expect(run.status).toBe("playing");
    expect(run.handSize).toBe(8);
    expect(run.deckRemaining).toBe(44);
    expect(run.target).toBe(300);
  });

  it("404 when playing with no active run", async () => {
    const token = await login("Frank");
    const r = await fetch(`${base}/api/run/play`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ selectedCardIds: ["KH"] }),
    });
    expect(r.status).toBe(404);
  });

  it("runs are isolated per user", async () => {
    const a = await login("Gina");
    const b = await login("Hank");
    await fetch(`${base}/api/run`, { method: "POST", headers: authed(a), body: JSON.stringify({ difficulty: "easy" }) });
    await fetch(`${base}/api/run`, { method: "POST", headers: authed(b), body: JSON.stringify({ difficulty: "hard" }) });

    const ra = (await (await fetch(`${base}/api/run/active`, { headers: authed(a) })).json()) as { run: { runId: string; difficulty: string } };
    const rb = (await (await fetch(`${base}/api/run/active`, { headers: authed(b) })).json()) as { run: { runId: string; difficulty: string } };
    expect(ra.run.runId).not.toBe(rb.run.runId);
    expect(ra.run.difficulty).toBe("easy");
    expect(rb.run.difficulty).toBe("hard");
  });
});

describe("decks, deck-peek, shop", () => {
  it("GET /api/decks returns the preset catalog", async () => {
    const token = await login("Ivy");
    const r = await fetch(`${base}/api/decks`, { headers: authed(token) });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { decks: { id: string; size: number }[] };
    const ids = body.decks.map((d) => d.id);
    expect(ids).toContain("standard");
    expect(ids).toContain("abandoned");
    expect(ids).toContain("checkered");
    expect(body.decks.find((d) => d.id === "abandoned")?.size).toBe(40);
  });

  it("starting with a deckId uses that composition (abandoned → 40)", async () => {
    const token = await login("Jade");
    await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium", deckId: "abandoned" }),
    });
    const blind = await fetch(`${base}/api/run/blind`, { method: "POST", headers: authed(token) });
    const run = (await blind.json()) as { deckRemaining: number; deckId: string };
    expect(run.deckId).toBe("abandoned");
    expect(run.deckRemaining).toBe(32); // 40 - 8
  });

  it("unknown deckId → 400", async () => {
    const token = await login("Kai");
    const r = await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium", deckId: "nope" }),
    });
    expect(r.status).toBe(400);
  });

  it("deck-peek returns grouped counts and leaks neither deck nor order", async () => {
    const token = await login("Lex");
    await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium", deckId: "checkered" }),
    });
    await fetch(`${base}/api/run/blind`, { method: "POST", headers: authed(token) });

    const p1 = await fetch(`${base}/api/run/deck`, { headers: authed(token) });
    expect(p1.status).toBe(200);
    const t1 = await p1.text();
    expect(t1).not.toContain('"deckComposition"');
    const peek = JSON.parse(t1) as {
      remaining: { total: number; bySuit: Record<string, number> };
      composition: { total: number };
    };
    expect(peek.composition.total).toBe(52);
    expect(peek.remaining.total).toBe(44); // 52 - 8
    expect(Object.keys(peek.remaining.bySuit).sort()).toEqual(["hearts", "spades"]);

    // two sequential peeks are byte-identical → no draw-order leak
    const t2 = await (await fetch(`${base}/api/run/deck`, { headers: authed(token) })).text();
    expect(t2).toBe(t1);
  });

  it("buy with no active run → 404; buy when not shopping → 409", async () => {
    const token = await login("Mara");
    const noRun = await fetch(`${base}/api/run/buy`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ itemId: "planet:saturn" }),
    });
    expect(noRun.status).toBe(404);

    await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium" }),
    });
    const notShopping = await fetch(`${base}/api/run/buy`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ itemId: "planet:saturn" }),
    });
    expect(notShopping.status).toBe(409); // selecting_blind, not shop
  });
});

describe("new run overwrites the active save", () => {
  it("starting a new run replaces the active one (new runId, fresh state)", async () => {
    const token = await login("Nova");
    const r1 = (await (
      await fetch(`${base}/api/run`, {
        method: "POST",
        headers: authed(token),
        body: JSON.stringify({ difficulty: "easy", deckId: "red" }),
      })
    ).json()) as { runId: string };
    await fetch(`${base}/api/run/blind`, { method: "POST", headers: authed(token) }); // advance it

    const r2res = await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "hard", deckId: "blue" }),
    });
    expect(r2res.status).toBe(201);
    const r2 = (await r2res.json()) as { runId: string; deckId: string; status: string; ante: number };
    expect(r2.runId).not.toBe(r1.runId);
    expect(r2.deckId).toBe("blue");
    expect(r2.status).toBe("selecting_blind");
    expect(r2.ante).toBe(1);

    const active = (await (
      await fetch(`${base}/api/run/active`, { headers: authed(token) })
    ).json()) as { run: { runId: string } };
    expect(active.run.runId).toBe(r2.runId); // the new run is the active one
  });

  it("an invalid deckId does not destroy the active run", async () => {
    const token = await login("Oz");
    const r1 = (await (
      await fetch(`${base}/api/run`, {
        method: "POST",
        headers: authed(token),
        body: JSON.stringify({ difficulty: "easy" }),
      })
    ).json()) as { runId: string };

    const bad = await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "easy", deckId: "nope" }),
    });
    expect(bad.status).toBe(400);

    const active = (await (
      await fetch(`${base}/api/run/active`, { headers: authed(token) })
    ).json()) as { run: { runId: string } | null };
    expect(active.run?.runId).toBe(r1.runId); // old run intact
  });
});

describe("jokers (API shape + guards)", () => {
  it("DTO exposes jokers + maxJokers; sell/reorder of an unowned joker → 404; no deck leak", async () => {
    const token = await login("Pia");
    await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium" }),
    });
    const blind = await fetch(`${base}/api/run/blind`, { method: "POST", headers: authed(token) });
    const blindText = await blind.text();
    expect(blindText).not.toContain('"deck"');
    expect(blindText).not.toContain('"deckComposition"');
    const run = JSON.parse(blindText) as { jokers: unknown[]; maxJokers: number };
    expect(run.jokers).toEqual([]);
    expect(run.maxJokers).toBe(5);

    const sell = await fetch(`${base}/api/run/sell`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ jokerId: "joker" }),
    });
    expect(sell.status).toBe(404);
    const reorder = await fetch(`${base}/api/run/reorder`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ jokerId: "joker", dir: "left" }),
    });
    expect(reorder.status).toBe(404);
  });
});

// PET-60: brute-force guard on /api/auth/login. Own server with a tiny per-IP cap so we can trip it
// deterministically without flooding (all test requests share the loopback IP → one bucket).
describe("login rate limiting", () => {
  let rlServer: Server;
  let rlBase: string;

  beforeAll(() => {
    // Reuse the already-migrated shared db; this block only hits /login so no run state collides.
    rlServer = createApp(db, { loginRateLimitMax: 3 }).listen(0) as unknown as Server;
    const addr = rlServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    rlBase = `http://localhost:${port}`;
  });

  afterAll(() => rlServer.close());

  it("429s once an IP exceeds the per-minute login cap", async () => {
    const attempt = (name: string) =>
      fetch(`${rlBase}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

    // First 3 succeed (cap = 3), the 4th is rejected.
    for (let i = 0; i < 3; i++) expect((await attempt(`RL${i}`)).status).toBe(201);

    const limited = await attempt("RL3");
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as { error: string };
    expect(body.error).toBe("rate_limited");
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });
});

// PET-59: invite gate on NEW account creation. Own server configured with a code + a small
// allowlist; the default suite server leaves the gate OFF, so existing tests are unaffected.
describe("invite gate (PET-59)", () => {
  let gServer: Server;
  let gBase: string;
  const CODE = "let-me-in";

  beforeAll(() => {
    gServer = createApp(db, {
      loginRateLimitMax: 10_000,
      inviteCode: CODE,
      inviteAllowlist: ["vip"], // lowercased; matched case-insensitively
    }).listen(0) as unknown as Server;
    const addr = gServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    gBase = `http://localhost:${port}`;
  });

  afterAll(() => gServer.close());

  const login = (body: Record<string, unknown>) =>
    fetch(`${gBase}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("rejects a new account with no / wrong invite code (403 invite_required)", async () => {
    const none = await login({ name: "Gatecrasher" });
    expect(none.status).toBe(403);
    expect(((await none.json()) as { error: string }).error).toBe("invite_required");

    const wrong = await login({ name: "Gatecrasher", inviteCode: "nope" });
    expect(wrong.status).toBe(403);
  });

  it("creates a new account with a valid invite code (201)", async () => {
    const r = await login({ name: "Invitee", inviteCode: CODE });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { user: { name: string } }).user.name).toBe("Invitee");
  });

  it("allows an allowlisted name without a code (case-insensitive)", async () => {
    const r = await login({ name: "VIP" }); // allowlist holds "vip"
    expect(r.status).toBe(201);
  });

  it("never gates an EXISTING user (re-login needs no code)", async () => {
    expect((await login({ name: "Returning", inviteCode: CODE })).status).toBe(201); // created
    const again = await login({ name: "Returning" }); // existing → resolves, no code needed
    expect(again.status).toBe(201);
  });
});
