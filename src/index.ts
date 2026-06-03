/** Server entrypoint: run migrations, then boot the app. */

import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { getDb, runMigrations } from "./db/client.ts";

const db = getDb();
await runMigrations(db);

const app = createApp(db);

app.listen(config.port, () => {
  console.log(`🃏 Co-latro backend on http://localhost:${config.port} (${config.env})`);
});
