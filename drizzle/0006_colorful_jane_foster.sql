CREATE TABLE `deliverable_template_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`estimated_minutes` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `deliverable_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deliverable_template_lines_template_id_sort_order_idx` ON `deliverable_template_lines` (`template_id`,`sort_order`);