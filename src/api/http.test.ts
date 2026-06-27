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

// PET-206: a shared password for test accounts. The default suite app leaves the invite gate
// OFF, so signup needs only a username + password.
const TEST_PW = "test-password-123";

/** Create a fresh credentialed account and return its token (most tests just need an authed user). */
async function signUp(name: string): Promise<string> {
  const r = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: name, password: TEST_PW }),
  });
  expect(r.status).toBe(201);
  const body = (await r.json()) as { token: string };
  return body.token;
}

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("auth (PET-206: signup + password login)", () => {
  it("signup returns token + user", async () => {
    const r = await post("/api/auth/signup", { username: "Alice", password: TEST_PW });
    expect(r.status).toBe(201);
    const body = (await r.json()) as { token: string; user: { name: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.name).toBe("Alice");
  });

  it("me works with a token; 401 without or with a bad one", async () => {
    const token = await signUp("Bob");
    const ok = await fetch(`${base}/api/auth/me`, { headers: authed(token) });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { user: { name: string } }).user.name).toBe("Bob");

    expect((await fetch(`${base}/api/auth/me`)).status).toBe(401);
    expect((await fetch(`${base}/api/auth/me`, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("login with the right password works (same user); a fresh login rotates the token", async () => {
    const t1 = await signUp("Carol");
    const u1 = (await (await fetch(`${base}/api/auth/me`, { headers: authed(t1) })).json()) as { user: { id: string } };
    const r = await post("/api/auth/login", { username: "Carol", password: TEST_PW });
    expect(r.status).toBe(200);
    const t2 = ((await r.json()) as { token: string }).token;
    const u2 = (await (await fetch(`${base}/api/auth/me`, { headers: authed(t2) })).json()) as { user: { id: string } };
    expect(u2.user.id).toBe(u1.user.id); // same account
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t1) })).status).toBe(401); // old token dead
  });

  it("login with the wrong password is 401 (and a non-existent user is the same 401)", async () => {
    await signUp("Dana");
    expect((await post("/api/auth/login", { username: "Dana", password: "wrong-password" })).status).toBe(401);
    // unknown user → same generic 401 (no username enumeration)
    const miss = await post("/api/auth/login", { username: "nobody-here", password: TEST_PW });
    expect(miss.status).toBe(401);
    expect(((await miss.json()) as { error: string }).error).toBe("invalid_credentials");
  });

  it("you cannot log in as an existing user without the password (closes F3)", async () => {
    await signUp("Pedro");
    // knowing only the username is no longer enough — must supply the password
    expect((await post("/api/auth/login", { username: "Pedro", password: "guess" })).status).toBe(401);
    expect((await post("/api/auth/login", { username: "Pedro" })).status).toBe(400); // no password
  });

  it("signup rejects a duplicate username with 409", async () => {
    await signUp("Sam");
    const r = await post("/api/auth/signup", { username: "Sam", password: "another-password" });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toBe("username_taken");
  });

  // PET-60/206: username validation — empty/whitespace, >40 chars, and control chars are rejected.
  it("signup rejects empty / whitespace / missing / non-string usernames with 400", async () => {
    for (const body of [{ password: TEST_PW }, { username: "", password: TEST_PW }, { username: "   ", password: TEST_PW }, { username: 123, password: TEST_PW }]) {
      const r = await post("/api/auth/signup", body);
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toBe("invalid_username");
    }
  });

  it("signup rejects usernames >40 chars and control chars (400, nothing created)", async () => {
    expect((await post("/api/auth/signup", { username: "x".repeat(41), password: TEST_PW })).status).toBe(400);
    for (const username of ["bad\x00name", "line\ninject", "tab\tsep", "del\x7f"]) {
      expect((await post("/api/auth/signup", { username, password: TEST_PW })).status).toBe(400);
    }
    const rows = await db.select().from(users).where(eq(users.name, "x".repeat(41)));
    expect(rows.length).toBe(0);
  });

  it("signup accepts a 40-char username (boundary)", async () => {
    const name = "y".repeat(40);
    const r = await post("/api/auth/signup", { username: name, password: TEST_PW });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { user: { name: string } }).user.name).toBe(name);
  });

  // PET-206: password must be >= 8 chars (and not absurdly long).
  it("signup rejects short / missing / over-long passwords with 400 invalid_password", async () => {
    for (const body of [{ username: "PwA" }, { username: "PwB", password: "short" }, { username: "PwC", password: "x".repeat(201) }]) {
      const r = await post("/api/auth/signup", body);
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toBe("invalid_password");
    }
    expect((await db.select().from(users).where(eq(users.name, "PwA"))).length).toBe(0);
  });

  it("the stored password is hashed, never the plaintext", async () => {
    await signUp("Hashy");
    const [row] = await db.select({ h: users.passwordHash }).from(users).where(eq(users.name, "Hashy")).limit(1);
    expect(row!.h).not.toBe(TEST_PW);
    expect(row!.h).toMatch(/^\$argon2id\$/); // argon2id PHC string
  });

  // PET-60: logout invalidates the current token server-side.
  it("logout invalidates the token (204; old token then 401), and re-login works", async () => {
    const t = await signUp("Quinn");
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t) })).status).toBe(200);

    const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: authed(t) });
    expect(out.status).toBe(204);

    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t) })).status).toBe(401); // token dead
    expect((await fetch(`${base}/api/auth/logout`, { method: "POST", headers: authed(t) })).status).toBe(401);

    const r = await post("/api/auth/login", { username: "Quinn", password: TEST_PW }); // can sign back in
    const t2 = ((await r.json()) as { token: string }).token;
    expect((await fetch(`${base}/api/auth/me`, { headers: authed(t2) })).status).toBe(200);
  });

  // PET-60: an expired token is rejected like an invalid one.
  it("rejects an expired token with 401 token_expired", async () => {
    const t = await signUp("Rex");
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

  it("signup sets a future token expiry (~30 days out)", async () => {
    await signUp("Sky");
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
    const token = await signUp("Dave");
    const r = await fetch(`${base}/api/run/active`, { headers: authed(token) });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { run: unknown }).run).toBeNull();
  });

  it("start → blind → playing, and never leaks the deck", async () => {
    const token = await signUp("Erin");
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
    const token = await signUp("Frank");
    const r = await fetch(`${base}/api/run/play`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ selectedCardIds: ["KH"] }),
    });
    expect(r.status).toBe(404);
  });

  it("runs are isolated per user", async () => {
    const a = await signUp("Gina");
    const b = await signUp("Hank");
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
    const token = await signUp("Ivy");
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
    const token = await signUp("Jade");
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
    const token = await signUp("Kai");
    const r = await fetch(`${base}/api/run`, {
      method: "POST",
      headers: authed(token),
      body: JSON.stringify({ difficulty: "medium", deckId: "nope" }),
    });
    expect(r.status).toBe(400);
  });

  it("deck-peek returns grouped counts and leaks neither deck nor order", async () => {
    const token = await signUp("Lex");
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
    const token = await signUp("Mara");
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
    const token = await signUp("Nova");
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
    const token = await signUp("Oz");
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
    const token = await signUp("Pia");
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

  it("429s once an IP exceeds the per-minute cap", async () => {
    const attempt = (name: string) =>
      fetch(`${rlBase}/api/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: name, password: TEST_PW }),
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

// PET-201: invite gate now validates against the co-latro-admin `invites` function. This server
// is configured with an admin URL; the server's outbound /validate call is mocked (URL-matched)
// so the test drives valid/used/unreachable outcomes. The default suite server leaves
// adminInvitesUrl empty → gate OFF there, so the existing tests are unaffected.
describe("invite gate (PET-201)", () => {
  let gServer: Server;
  let gBase: string;
  const ADMIN = "http://admin.invalid/function/invites";
  const realFetch = globalThis.fetch;
  // Per-test control of the mocked admin /validate response (keyed on the submitted code).
  let adminReply: (code: string, user: string) => Response;

  beforeAll(() => {
    // Intercept ONLY the server's outbound call to the admin invites fn; the test's own calls
    // to gBase use realFetch directly, so they're never intercepted.
    globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(ADMIN)) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { code: string; user: string };
        return adminReply(body.code, body.user);
      }
      return realFetch(input as Parameters<typeof fetch>[0], init);
    }) as typeof fetch;
    gServer = createApp(db, { loginRateLimitMax: 10_000, adminInvitesUrl: ADMIN }).listen(0) as unknown as Server;
    const addr = gServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    gBase = `http://localhost:${port}`;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    gServer.close();
  });

  // Signup with a username + password (+ optional invite code) against the gated server.
  const doSignup = (body: Record<string, unknown>) =>
    realFetch(`${gBase}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: TEST_PW, ...body }),
    });

  it("rejects signup with no invite code (403 invite_required, no admin call)", async () => {
    adminReply = () => { throw new Error("admin must not be called when no code is given"); };
    const r = await doSignup({ username: "Gatecrasher" });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: string }).error).toBe("invite_required");
  });

  it("creates the account when the admin claims the code (201)", async () => {
    adminReply = (code) =>
      code === "good" ? Response.json({ ok: true }) : Response.json({ ok: false, error: "unknown code" }, { status: 404 });
    const r = await doSignup({ username: "Invitee", inviteCode: "good" });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { user: { name: string } }).user.name).toBe("Invitee");
  });

  it("maps an already-used code to 403 (admin 409)", async () => {
    adminReply = () => Response.json({ ok: false, error: "already used" }, { status: 409 });
    const r = await doSignup({ username: "LateComer", inviteCode: "burned" });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { message: string }).message).toMatch(/already been used/i);
  });

  it("fails closed when the admin service is unreachable (403)", async () => {
    adminReply = () => { throw new Error("network down"); };
    const r = await doSignup({ username: "Unlucky", inviteCode: "whatever" });
    expect(r.status).toBe(403);
  });

  it("LOGIN never hits the invite gate (only signup does)", async () => {
    adminReply = (code) =>
      code === "good" ? Response.json({ ok: true }) : Response.json({ ok: false, error: "unknown code" }, { status: 404 });
    expect((await doSignup({ username: "Returning", inviteCode: "good" })).status).toBe(201); // created
    adminReply = () => { throw new Error("login must not call the admin invite gate"); };
    const again = await realFetch(`${gBase}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Returning", password: TEST_PW }),
    });
    expect(again.status).toBe(200); // logs in with the password, no admin call
  });

  // PET-203 (F5): a rejected invite must not leave an orphaned account behind. The row is created
  // before the (failure-prone) remote claim, so the rejection path must roll it back — otherwise the
  // username is squatted and the tester could never re-use it.
  it("rolls back the new account when the admin rejects the code (no squatted username)", async () => {
    adminReply = () => Response.json({ ok: false, error: "unknown code" }, { status: 404 });
    expect((await doSignup({ username: "Rollback", inviteCode: "bad" })).status).toBe(403);
    const rows = await db.select().from(users).where(eq(users.name, "Rollback"));
    expect(rows.length).toBe(0); // rolled back — nothing persisted
    // and the username is still free: a valid code now creates the account fresh (gate runs, 201)
    adminReply = (code) =>
      code === "good" ? Response.json({ ok: true }) : Response.json({ ok: false, error: "unknown code" }, { status: 404 });
    expect((await doSignup({ username: "Rollback", inviteCode: "good" })).status).toBe(201);
  });
});

// PET-204 (F2): the backend authenticates to the invites function with a scoped Bearer token
// (the function is its own authz boundary — faasd doesn't auth /function/* invokes). Configuring
// adminInvitesToken must send `Authorization: Bearer <token>`, not the gateway basic-auth.
describe("invite token (PET-204/F2)", () => {
  let tServer: Server;
  let tBase: string;
  const ADMIN = "http://admin-token.invalid/function/invites";
  const TOKEN = "scoped-invites-secret-xyz";
  const realFetch = globalThis.fetch;
  let seenAuth: string | null = null;

  beforeAll(() => {
    globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(ADMIN)) {
        seenAuth = new Headers(init?.headers).get("authorization");
        return Response.json({ ok: true });
      }
      return realFetch(input as Parameters<typeof fetch>[0], init);
    }) as typeof fetch;
    tServer = createApp(db, {
      loginRateLimitMax: 10_000,
      adminInvitesUrl: ADMIN,
      adminInvitesToken: TOKEN,
    }).listen(0) as unknown as Server;
    const addr = tServer.address();
    tBase = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    tServer.close();
  });

  it("sends the scoped Bearer token (not basic-auth) to the invites function", async () => {
    const r = await realFetch(`${tBase}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "TokenUser", password: TEST_PW, inviteCode: "anything" }),
    });
    expect(r.status).toBe(201);
    expect(seenAuth).toBe(`Bearer ${TOKEN}`);
  });
});
