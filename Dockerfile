# Co-latro backend — Bun + Express + Drizzle/Postgres.
# Runs Drizzle migrations on boot (src/index.ts: `await runMigrations(db)`), then serves on :3020.
FROM oven/bun:1.3.8-slim

WORKDIR /app

# Install deps first for layer caching. --production drops drizzle-kit & types (migrations are
# applied at runtime by drizzle-orm's migrator reading src/db/migrations, not by drizzle-kit).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# App source (includes src/db/migrations, applied on boot).
COPY . .

ENV NODE_ENV=production
ENV PORT=3020
EXPOSE 3020

# DATABASE_URL must be provided at runtime (sourced from Vault by the deploy tooling).
CMD ["bun", "run", "start"]
