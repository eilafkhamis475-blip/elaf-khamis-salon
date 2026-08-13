CREATE TABLE `bookingEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`actor` varchar(64) NOT NULL,
	`type` varchar(64) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookingEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(32) NOT NULL,
	`clientId` int NOT NULL,
	`serviceId` int NOT NULL,
	`stylistId` int,
	`startsAt` bigint NOT NULL,
	`endsAt` bigint NOT NULL,
	`companions` int NOT NULL DEFAULT 0,
	`status` enum('pending','confirmed','cancelled','rescheduled','completed') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`reminderMarkedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(180) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`area` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `salonSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openingHour` int NOT NULL DEFAULT 10,
	`closingHour` int NOT NULL DEFAULT 20,
	`slotIntervalMinutes` int NOT NULL DEFAULT 30,
	`maximumCompanions` int NOT NULL DEFAULT 9,
	`cancellationLeadHours` int NOT NULL DEFAULT 24,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salonSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`durationMinutes` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `stylists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`specialty` varchar(160),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stylists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bookingEvents_bookingId_idx` ON `bookingEvents` (`bookingId`);--> statement-breakpoint
CREATE INDEX `bookings_startsAt_idx` ON `bookings` (`startsAt`);--> statement-breakpoint
CREATE INDEX `bookings_clientId_idx` ON `bookings` (`clientId`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);