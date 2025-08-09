import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable(
	'messages',
	{
		id: text().notNull().primaryKey(),
		sender: text().notNull(),
		chatJid: text().notNull(),
		repliedToId: text(),
		content: text(),
		editedContentHistories: text({
			mode: 'json',
		})
			.$type<Array<string>>()
			.default([]),
		isDeleted: integer({
			mode: 'boolean',
		}).default(false),
		createdAt: integer({
			mode: 'timestamp',
		}).default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index('id_idx').on(table.id)],
);
