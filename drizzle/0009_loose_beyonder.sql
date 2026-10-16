CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`deliverable_id` text,
	`minutes` integer NOT NULL,
	`note` text,
	`worked_on` text NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`billed_invoice_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_entries_project_id_worked_on_idx` ON `time_entries` (`project_id`,`worked_on`);--> statement-breakpoint
CREATE INDEX `time_entries_deliverable_id_idx` ON `time_entries` (`deliverable_id`);