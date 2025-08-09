import { db } from '@/libraries/drizzle.js';
import { messages } from '@/schemas/messages-schema.js';
import type { WAMessageKey } from 'baileys';
import { inArray } from 'drizzle-orm';

export const deleteMessagesHandler = async (messageKeys: WAMessageKey[]) => {
	const messageIds = messageKeys.map((key) => key.id).filter((key) => key);
	await db
		.update(messages)
		.set({
			isDeleted: true,
		})
		.where(inArray(messages.id, messageIds as string[]));
};
