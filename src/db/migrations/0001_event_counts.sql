CREATE TABLE "event_counts" (
	"date" date PRIMARY KEY NOT NULL,
	"runs_started" integer DEFAULT 0 NOT NULL,
	"runs_won" integer DEFAULT 0 NOT NULL,
	"runs_lost" integer DEFAULT 0 NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL
);
