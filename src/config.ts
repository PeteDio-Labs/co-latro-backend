/** Runtime configuration, read once at boot. */

// Default the SQLite file to LOCAL disk (never the SMB-mounted repo — WAL corrupts over smbfs).
const defaultDbPath = `${process.env.HOME ?? "."}/.local/share/poker-mvp/poker.db`;

export const config = {
  port: Number(process.env.PORT) || 3020,
  env: process.env.NODE_ENV ?? "development",
  dbPath: process.env.POKER_DB_PATH ?? defaultDbPath,
} as const;
