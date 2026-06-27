-- PET-206: switch to credentialed accounts (username + argon2id password). Existing rows are
-- name-only (no password) and can't be back-filled, so wipe to a clean slate first (decision:
-- prealpha, no save data preserved). The game_sessions FK is ON DELETE CASCADE, so this clears
-- runs too. After the table is empty, password_hash can be added NOT NULL with no default.
DELETE FROM "users";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text NOT NULL;
