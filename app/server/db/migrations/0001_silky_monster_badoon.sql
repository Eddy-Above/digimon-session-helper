CREATE TABLE `evolution_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`chain` text NOT NULL,
	`partner_id` text,
	`current_stage_index` integer DEFAULT 0 NOT NULL,
	`evolution_progress` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `tamers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `digimon` ADD `size` text DEFAULT 'medium' NOT NULL;