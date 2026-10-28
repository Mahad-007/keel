CREATE TABLE `active_timers` (
	`id` text PRIMARY KEY NOT NULL,
	`slot` text DEFAULT 'only' NOT NULL,
	`project_id` text NOT NULL,
	`deliverable_id` text,
	`note` text,
	`billable` integer DEFAULT true NOT NULL,
	`started_at` text NOT NULL,
	`started_on` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_timers_slot_idx` ON `active_timers` (`slot`);