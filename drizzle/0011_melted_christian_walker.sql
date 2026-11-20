CREATE TABLE `burn_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`on_date` text NOT NULL,
	`contract_value_cents` integer NOT NULL,
	`rate_cents` integer NOT NULL,
	`rate_source` text NOT NULL,
	`entry_count` integer NOT NULL,
	`logged_minutes` integer NOT NULL,
	`billable_minutes` integer NOT NULL,
	`burned_cents` integer NOT NULL,
	`chargeable_cents` integer NOT NULL,
	`origin` text DEFAULT 'recorded' NOT NULL,
	`captured_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `burn_snapshots_project_id_on_date_idx` ON `burn_snapshots` (`project_id`,`on_date`);