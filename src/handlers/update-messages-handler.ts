import { db } from '@/libraries/drizzle.js';
import { messages as messagesSchema } from '@/schemas/messages-schema.js';
import type { WAMessageUpdate } from 'baileys';
import { eq } from 'drizzle-orm';

export const updateMessagesHandler = async (messages: WAMessageUpdate[]) => {
	const msg = messages[0].update.message?.editedMessage
		? {
				message: messages[0].update.message.editedMessage.message,
			}
		: messages[0].update;
	const messageId = messages[0].key.id;

	if (!messageId) {
		return;
	}

	// Deleted message
	if (!msg.message) {
		await db
			.update(messagesSchema)
			.set({
				isDeleted: true,
			})
			.where(eq(messagesSchema.id, messageId));
	}

	const text =
		msg.message?.conversation?.trim() ??
		msg.message?.extendedTextMessage?.text?.trim() ??
		msg.message?.imageMessage?.caption?.trim() ??
		msg.message?.documentMessage?.caption?.trim() ??
		msg.message?.videoMessage?.caption?.trim() ??
		msg.message?.viewOnceMessageV2?.message?.conversation?.trim() ??
		msg.message?.viewOnceMessage?.message?.conversation?.trim() ??
		msg.message?.viewOnceMessage?.message?.imageMessage?.caption?.trim() ??
		msg.message?.viewOnceMessage?.message?.videoMessage?.caption?.trim() ??
		msg.message?.viewOnceMessageV2?.message?.imageMessage?.caption?.trim() ??
		msg.message?.viewOnceMessageV2?.message?.videoMessage?.caption?.trim();

	if (!text) {
		return;
	}

	const rowMessage = await db.query.messages.findFirst({
		where: (msgs, { eq }) => eq(msgs.id, messageId),
	});

	if (!rowMessage) {
		return;
	}

	rowMessage.editedContentHistories = [...(rowMessage.editedContentHistories ?? []), text];
	await db.update(messagesSchema).set(rowMessage).where(eq(messagesSchema.id, messageId));
};
