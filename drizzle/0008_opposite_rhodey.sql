CREATE TABLE `scope_snapshot_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`deliverable_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`estimated_minutes` integer NOT NULL,
	`status` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `scope_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scope_snapshot_lines_snapshot_id_sort_order_idx` ON `scope_snapshot_lines` (`snapshot_id`,`sort_order`);