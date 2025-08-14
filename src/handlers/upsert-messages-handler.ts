import { db } from '@/libraries/drizzle.js';
import { messages as messagesSchema } from '@/schemas/messages-schema.js';
import { uploadObjectStream } from '@/storage-objects/upload-object.js';
import mimes from 'mime-types';
import { WAProto, downloadContentFromMessage, type WAMessage, type makeWASocket } from 'baileys';
import consola from 'consola';
import { eq } from 'drizzle-orm';
import { configEnv } from '@/config/env.js';

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

		const isGroup = msg.key.remoteJid?.endsWith('@g.us') ?? false;
		const ownerLids = configEnv.OWNER_LIDS.split(',').map((lid) => lid.trim());

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

		if (messages[0].message?.editedMessage && text?.length) {
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
			if (text?.length) {
				await db.insert(messagesSchema).values({
					id: messageId,
					chatJid: msg.key.remoteJid ?? '',
					content: text,
					editedContentHistories: [],
					isDeleted: false,
					repliedToId: undefined,
					sender: authorNumber.concat(' | ', msg.pushName ?? 'Unknown'),
					isGroup,
					createdAt: new Date(),
				});
			}
		}

		// Detect view once
		const viewOnceMessage =
			(
				msg.message?.viewOnceMessage ??
				msg.message?.viewOnceMessageV2 ??
				msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage ??
				msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessageV2
			)?.message ?? msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

		if (viewOnceMessage) {
			const viewOnceMessageId =
				msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? messageId;
			let path = '';

			const imageMessage = viewOnceMessage.imageMessage;
			if (imageMessage?.mimetype) {
				const extension = mimes.extension(imageMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(imageMessage, 'image');
				uploadObjectStream(`images/${viewOnceMessageId}.${extension}`, media);
				path = `images/${viewOnceMessageId}.${extension}`;
			}

			const videoMessage = viewOnceMessage.videoMessage;
			if (videoMessage?.mimetype) {
				const extension = mimes.extension(videoMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(videoMessage, 'video');
				uploadObjectStream(`videos/${viewOnceMessageId}.${extension}`, media);
				path = `videos/${viewOnceMessageId}.${extension}`;
			}

			const audioMessage = viewOnceMessage.audioMessage;
			if (audioMessage?.mimetype) {
				const extension = mimes.extension(audioMessage.mimetype);
				if (!extension) {
					return;
				}

				const media = await downloadContentFromMessage(audioMessage, 'audio');
				uploadObjectStream(`audios/${viewOnceMessageId}.${extension}`, media);
				path = `videos/${viewOnceMessageId}.${extension}`;
			}


			if (isGroup && ownerLids.includes(authorNumber)) {
				if (text === '.testrvo')
				{
					await socket.sendMessage(msg.key.remoteJid ?? '', {
						text: new URL(`./${path}`, configEnv.S3_URL).href,
					}, {
						quoted: msg,
					});
				}
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
