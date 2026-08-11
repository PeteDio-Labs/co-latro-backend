# Co-latro — Backend

The authoritative game server for **Co-latro**, a neon Cyber-HUD roguelike poker game (a mini, co-op-bound
[Balatro](https://www.playbalatro.com/)). It owns the hidden deck, evaluates and scores hands
(`chips × mult`, hand levels, and jokers), runs the ante → blind → shop state machine, and persists every
run. The browser client (**co-latro-frontend**) only ever talks to this server over HTTP.

**Stack:** Bun · Express 5 · TypeScript · Drizzle ORM over Postgres (`postgres-js`).

## Run it

Requires [Bun](https://bun.sh) and a Postgres instance.

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=colatro postgres:17
cp .env.example .env   # then tweak DATABASE_URL if needed
bun install
bun run dev        # http://localhost:3020 — runs migrations on boot
```

Configured by env (`.env.example` documents the full contract): `PORT` (3020), `NODE_ENV`, and
**`DATABASE_URL`** (Postgres connection string; in prod sourced from Vault `kv/poker/db`).

```bash
# Tests need a Postgres — point TEST_DATABASE_URL at an ephemeral one (never the live DB):
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=colatro postgres:17
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/colatro bun test  # 117 cases
bun run typecheck
```

## How it works

- **DB-authoritative.** Each run is server-owned and keyed by the authenticated user; the client can't
  mutate state except through the API. Runs survive restarts.
- **Hidden deck.** The deck + composition never cross the DTO boundary (`toRunDTO`); the deck-peek endpoint
  returns only sorted grouped counts (never draw order).
- **Scoring.** `score = (baseChips + scoring-card chips, level-adjusted) × baseMult`, then jokers fold
  **left-to-right** — order matters (×Mult applies after +Mult).
- **Auth is light.** Name → token (find-or-create; the token is bearer-equivalent).

## API

`/api/auth/login` is the only unauthenticated route; everything else needs `Authorization: Bearer <token>`.
No response includes the hidden deck.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ name }` | Find-or-create; returns `{ token, user }`. Per-IP rate-limited (~10/min); name 1–40 chars; token expires in 30d. |
| POST | `/api/auth/logout` | — | Invalidate the current token (204). |
| GET | `/api/auth/me` | — | Resolve current user. |
| GET | `/api/decks` | — | Preset deck catalog. |
| GET | `/api/run/active` | — | Latest non-terminal run, or `null`. |
| POST | `/api/run` | `{ difficulty, deckId? }` | Start a run (overwrites the active one). |
| POST | `/api/run/blind` | — | Deal the current blind. |
| POST | `/api/run/play` | `{ selectedCardIds }` | Score a hand. |
| POST | `/api/run/discard` | `{ selectedCardIds }` | Swap cards; no score, no hand spent. |
| POST | `/api/run/preview` | `{ selectedCardIds }` | Non-mutating projected score. |
| POST | `/api/run/buy` | `{ itemId }` | Buy a planet (level a hand) or a joker. |
| POST | `/api/run/sell` | `{ jokerId }` | Sell a joker. |
| POST | `/api/run/reorder` | `{ jokerId, dir }` | Move a joker `"left"`/`"right"`. |
| POST | `/api/run/reroll` | — | Reroll the shop. |
| POST | `/api/run/continue` | — | Shop → next blind / ante / win. |
| GET | `/api/run/deck` | — | Deck peek (grouped counts). |
| POST | `/api/run/abandon` | — | End the active run. |

## Layout

```
src/
├─ cards.ts        deck, shuffle, faces, chip values
├─ evaluator.ts    pure best-hand + scoring-card detection
├─ scoring.ts      base + per-level tables, handFeatures, scoreHand (levels + joker fold)
├─ difficulty.ts   Difficulty + HAND_SIZE / MAX_SELECT
├─ engine/         ante · decks · jokers · shop · run (state machine, toRunDTO) · errors
├─ db/             Drizzle + postgres-js, run persistence + legacy backfill
└─ middleware/auth.ts · api/{auth,decks,run}.ts · app.ts · index.ts
```

## Deploy / CI

A long-running HTTP service on `:3020`, shipped as a Docker image (`Dockerfile`, `oven/bun` base) that
runs migrations on boot then `bun run start`. CI (`.github/workflows/ci.yml`, Workflow A on the self-hosted
homelab runner): **PR** → install + typecheck + test (against an ephemeral Postgres service) + image build;
**merge to `main`** → build + push to the registry (`docker.pdlab.dev`) via `scripts/deploy.sh`, then roll out on
the poker-api VM (the VM rollout is wired infra-side in `petedio-iac` — see the TODO in `deploy.sh`).
