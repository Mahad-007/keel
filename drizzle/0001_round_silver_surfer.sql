CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`contract_value_cents` integer DEFAULT 0 NOT NULL,
	`rate_cents` integer,
	`started_at` text,
	`closed_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
