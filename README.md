# Co-latro — Backend

The authoritative game server for **Co-latro**, a neon Cyber-HUD roguelike poker game (a mini, co-op-bound
[Balatro](https://www.playbalatro.com/)). It owns the hidden deck, evaluates and scores hands
(`chips × mult`, hand levels, and jokers), runs the ante → blind → shop state machine, and persists every
run. The browser client (**co-latro-frontend**) only ever talks to this server over HTTP.

**Stack:** Bun · Express 5 · TypeScript · Drizzle ORM over `bun:sqlite`.

## Run it

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # http://localhost:3020 — runs migrations on boot
```

The SQLite file lives **off the repo** at `~/.local/share/poker-mvp/poker.db` (override with `POKER_DB_PATH`).

```bash
bun test           # engine, scoring, jokers, decks, shop, persistence, HTTP (117 cases)
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
| POST | `/api/auth/login` | `{ name }` | Find-or-create; returns `{ token, user }`. |
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
├─ db/             Drizzle + bun:sqlite, run persistence + legacy backfill
└─ middleware/auth.ts · api/{auth,decks,run}.ts · app.ts · index.ts
```

## Deploy / CI

A long-running HTTP service on `:3020`. Build & run with Bun (`bun run start`). Container image + pipeline
config live with the CI workflow.
