CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'standard' NOT NULL,
	"tamer_ids" text NOT NULL,
	"encounter_ids" text NOT NULL,
	"current_encounter_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "digimon" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"stage" text NOT NULL,
	"attribute" text NOT NULL,
	"family" text NOT NULL,
	"type" text,
	"size" text DEFAULT 'medium' NOT NULL,
	"base_stats" text NOT NULL,
	"attacks" text NOT NULL,
	"qualities" text NOT NULL,
	"data_optimization" text,
	"base_dp" integer NOT NULL,
	"bonus_dp" integer DEFAULT 0 NOT NULL,
	"bonus_stats" text DEFAULT '{"accuracy":0,"damage":0,"dodge":0,"armor":0,"health":0}' NOT NULL,
	"bonus_dp_for_qualities" integer DEFAULT 0 NOT NULL,
	"current_wounds" integer DEFAULT 0 NOT NULL,
	"current_stance" text DEFAULT 'neutral' NOT NULL,
	"evolution_path_ids" text NOT NULL,
	"evolves_from_id" text,
	"partner_id" text,
	"is_enemy" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sprite_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "encounters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"phase" text DEFAULT 'setup' NOT NULL,
	"participants" text NOT NULL,
	"turn_order" text NOT NULL,
	"current_turn_index" integer DEFAULT 0 NOT NULL,
	"battle_log" text NOT NULL,
	"hazards" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evolution_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"chain" text NOT NULL,
	"partner_id" text,
	"current_stage_index" integer DEFAULT 0 NOT NULL,
	"evolution_progress" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tamers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"campaign_level" text NOT NULL,
	"attributes" text NOT NULL,
	"skills" text NOT NULL,
	"aspects" text NOT NULL,
	"torments" text NOT NULL,
	"special_orders" text NOT NULL,
	"inspiration" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_bonuses" text DEFAULT '{"attributes":{"agility":0,"body":0,"charisma":0,"intelligence":0,"willpower":0},"skills":{"dodge":0,"fight":0,"stealth":0,"athletics":0,"endurance":0,"featsOfStrength":0,"manipulate":0,"perform":0,"persuasion":0,"computer":0,"survival":0,"knowledge":0,"perception":0,"decipherIntent":0,"bravery":0},"inspiration":0}' NOT NULL,
	"equipment" text NOT NULL,
	"current_wounds" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sprite_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "digimon" ADD CONSTRAINT "digimon_partner_id_tamers_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."tamers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evolution_lines" ADD CONSTRAINT "evolution_lines_partner_id_tamers_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."tamers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
