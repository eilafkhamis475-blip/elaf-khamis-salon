CREATE TABLE `bookingSlots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`slotStartAt` bigint NOT NULL,
	`slotKey` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookingSlots_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookingSlots_slotKey_unique` UNIQUE(`slotKey`)
);
--> statement-breakpoint
CREATE INDEX `bookingSlots_bookingId_idx` ON `bookingSlots` (`bookingId`);--> statement-breakpoint
CREATE INDEX `bookingSlots_slotStartAt_idx` ON `bookingSlots` (`slotStartAt`);