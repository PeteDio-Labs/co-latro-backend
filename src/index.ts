/** Server entrypoint: run migrations, then boot the app. */

import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { getDb, runMigrations } from "./db/client.ts";

const db = getDb();
runMigrations(db);

const app = createApp(db);

app.listen(config.port, () => {
  console.log(
    `🃏 Poker MVP backend on http://localhost:${config.port} (${config.env}) · db=${config.dbPath}`,
  );
});
