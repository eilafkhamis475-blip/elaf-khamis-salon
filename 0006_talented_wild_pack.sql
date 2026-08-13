CREATE TABLE `financeEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('income','expense') NOT NULL,
	`amount` int NOT NULL,
	`bookingId` int,
	`category` varchar(80) NOT NULL,
	`description` text,
	`occurredAt` bigint NOT NULL,
	`isVoided` boolean NOT NULL DEFAULT false,
	`voidedAt` bigint,
	`voidReason` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financeEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `financeEntries_bookingId_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE INDEX `financeEntries_occurredAt_idx` ON `financeEntries` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `financeEntries_kind_occurredAt_idx` ON `financeEntries` (`kind`,`occurredAt`);