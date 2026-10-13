CREATE TABLE `scope_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text,
	`contract_value_cents` integer NOT NULL,
	`captured_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scope_snapshots_project_id_captured_at_idx` ON `scope_snapshots` (`project_id`,`captured_at`);