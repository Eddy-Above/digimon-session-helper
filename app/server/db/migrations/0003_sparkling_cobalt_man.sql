ALTER TABLE "encounters" ALTER COLUMN "participants" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "turn_order" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "battle_log" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "hazards" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "pending_requests" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "request_responses" text DEFAULT '[]' NOT NULL;