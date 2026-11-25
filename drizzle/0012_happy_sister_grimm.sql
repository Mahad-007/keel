ALTER TABLE `clients` ADD `nearly_spent_percent` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `ahead_of_delivery_percent` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `far_ahead_of_delivery_percent` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `recent_rate_window_days` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `pace_shift_percent` integer;