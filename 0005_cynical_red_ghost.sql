ALTER TABLE `bookings` ADD `preparationPlace` varchar(32) DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `locationUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `bookings` ADD `clientNotes` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `totalPrice` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `depositAmount` int DEFAULT 0 NOT NULL;