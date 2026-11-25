ALTER TABLE `projects` ADD `nearly_spent_percent` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `ahead_of_delivery_percent` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `far_ahead_of_delivery_percent` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `recent_rate_window_days` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `pace_shift_percent` integer;