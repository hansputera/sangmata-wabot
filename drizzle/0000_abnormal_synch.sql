CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`chatJid` text NOT NULL,
	`repliedToId` text,
	`content` text,
	`editedContentHistories` text DEFAULT '[]',
	`isDeleted` integer DEFAULT false,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `id_idx` ON `messages` (`id`);