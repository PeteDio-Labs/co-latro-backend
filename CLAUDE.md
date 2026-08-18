# Co-latro backend (Agent Context)

Bun / Express / Drizzle service on `:3020`. Workspace-level context — the clone
layout, the tracker, the homelab conventions — lives in `petedio-workspace` at
`.claude/CLAUDE.md`. This file holds repo-local agent context only.

## Writing style

Write in **Google developer documentation style** — the standing default for prose
in this repo: PR descriptions, commit bodies, work-item comments, docs, and code
comments.

- **Second person.** The reader is *you*; use *I* for yourself, never *we* for the reader.
- **Active voice.** Name who does the thing.
- **Conditions before instructions:** *To rebuild the index, run X* — not *Run X if
  you want to rebuild the index.*
- **Answer first**, detail after.
- **Cut filler:** *just*, *simply*, *easy*, *please note*, *in order to*. Never call
  something easy.
- **No time-anchored words** in durable prose: *currently*, *new*, *now*, *latest*,
  *existing*.
- **Sentence case** headings; code font for paths, commands, flags, and `PET-<n>` keys.
- Sentences under 26 words. Write *lets you* not *allows you to*, *run* not *execute*.

This governs how sentences are written, not how many. Don't restyle prose you aren't
already editing.
