ALTER TABLE `bookings` ADD `googleCalendarEventId` varchar(512);--> statement-breakpoint
ALTER TABLE `bookings` ADD `googleSyncStatus` varchar(32) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `googleSyncError` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `googleSyncedAt` bigint;