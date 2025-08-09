import { db } from '@/libraries/drizzle.js';
import { messages as messagesSchema } from '@/schemas/messages-schema.js';
import { uploadObjectStream } from '@/storage-objects/upload-object.js';
import mimes from 'mime-types';
import { WAProto, downloadContentFromMessage, type WAMessage, type makeWASocket } from 'baileys';
import consola from 'consola';
import { eq } from 'drizzle-orm';

export const upsertMessagesHandler = async (
	messages: WAMessage[],
	socket: ReturnType<typeof makeWASocket>,
) => {
	try {
		const msg = messages[0].message?.editedMessage
			? {
					key:
						messages[0].message.editedMessage.message?.protocolMessage?.key ??
						messages[0].key,
					message:
						messages[0].message.editedMessage.message?.protocolMessage?.editedMessage,
				}
			: messages[0];

		// Ignore statuses
		if (
			msg.key.remoteJid === 'status@broadcast' ||
			msg.message?.stickerMessage ||
			msg.message?.protocolMessage?.type === WAProto.Message.ProtocolMessage.Type.REVOKE
		) {
			return;
		}

		const messageId = msg.key.id;
		if (!messageId) {
			return;
		}

		const authorNumber = msg.participant
			? msg.participant.replace(/@.+/gi, '')
			: msg.key.participant
				? msg.key.participant.replace(/@.+/gi, '')
				: msg.key.fromMe
					? socket.user?.id.replace(/:[0-9]+@.+/gi, '') ?? 'ME'
					: msg.key.remoteJid?.replace(/@.+/gi, '');

		if (!authorNumber) {
			return;
		}

		const text =
			msg.message?.conversation?.trim() ??
			msg.message?.extendedTextMessage?.text?.trim() ??
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

		if (messages[0].message?.editedMessage) {
			const row = await db.query.messages.findFirst({
				where: (msgs, { eq }) => eq(msgs.id, messageId),
			});

			if (row) {
				await db
					.update(messagesSchema)
					.set({
						content: text,
						editedContentHistories: [
							...(row.editedContentHistories ?? []),
							row.content ?? '',
						],
					})
					.where(eq(messagesSchema.id, messageId));
			}
		} else {
			await db.insert(messagesSchema).values({
				id: messageId,
				chatJid: msg.key.remoteJid ?? '',
				content: text,
				editedContentHistories: [],
				isDeleted: false,
				repliedToId: undefined,
				sender: authorNumber,
				createdAt: new Date(),
			});
		}

		// Detect view once
		const viewOnceMessage = (
			msg.message?.viewOnceMessage ??
			msg.message?.viewOnceMessageV2 ??
			msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage ??
			msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessageV2
		)?.message;

		if (viewOnceMessage) {
			const imageMessage = viewOnceMessage.imageMessage;
			if (imageMessage?.mimetype) {
				const extension = mimes.extension(imageMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(imageMessage, 'image');
				uploadObjectStream(`images/${messageId}.${extension}`, media);
			}

			const videoMessage = viewOnceMessage.videoMessage;
			if (videoMessage?.mimetype) {
				const extension = mimes.extension(videoMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(videoMessage, 'video');
				uploadObjectStream(`videos/${messageId}.${extension}`, media);
			}

			const audioMessage = viewOnceMessage.audioMessage;
			if (audioMessage?.mimetype) {
				const extension = mimes.extension(audioMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(audioMessage, 'audio');
				uploadObjectStream(`audios/${messageId}.${extension}`, media);
			}
		}

		// Upload non view once image
		const imageMessage = msg.message?.imageMessage;
		if (imageMessage?.mimetype) {
			const extension = mimes.extension(imageMessage.mimetype);
			if (!extension) {
				return;
			}

			const media = await downloadContentFromMessage(imageMessage, 'image');
			uploadObjectStream(`images/${messageId}.${extension}`, media);
		}

		const videoMessage = msg.message?.videoMessage;
		if (videoMessage?.mimetype) {
			const extension = mimes.extension(videoMessage.mimetype);
			if (!extension) {
				return;
			}

			const media = await downloadContentFromMessage(videoMessage, 'video');
			uploadObjectStream(`videos/${messageId}.${extension}`, media);
		}

		const documentMessage =
			msg.message?.documentMessage ??
			msg.message?.documentWithCaptionMessage?.message?.documentMessage;
		if (documentMessage?.mimetype) {
			const extension = mimes.extension(documentMessage.mimetype);
			if (!extension) {
				return;
			}

			const media = await downloadContentFromMessage(documentMessage, 'document');
			uploadObjectStream(`documents/${messageId}.${extension}`, media);
		}
	} catch (e) {
		consola.error(
			`[UpsertHandler] Failed to proceed ${messages[0].key.id} because ${(e as Error).message}`,
		);
	}
};
