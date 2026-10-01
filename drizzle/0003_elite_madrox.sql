CREATE TABLE `project_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_status_events_project_id_idx` ON `project_status_events` (`project_id`);