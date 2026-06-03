CREATE TABLE "game_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"ante" integer NOT NULL,
	"difficulty" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"last_seen_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "users_name_unique" UNIQUE("name"),
	CONSTRAINT "users_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user_status" ON "game_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_updated" ON "game_sessions" USING btree ("user_id","updated_at");