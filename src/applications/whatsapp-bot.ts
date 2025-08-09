import { configEnv } from '@/config/env.js';
import { deleteMessagesHandler } from '@/handlers/delete-messages-handler.js';
import { updateMessagesHandler } from '@/handlers/update-messages-handler.js';
import { upsertMessagesHandler } from '@/handlers/upsert-messages-handler.js';
import { redisClient } from '@/libraries/redis.js';
import { jsonParse } from '@/utils/json-parse.js';
import type { Boom } from '@hapi/boom';
import {
	Browsers,
	DisconnectReason,
	makeCacheableSignalKeyStore,
	makeWASocket,
	useMultiFileAuthState,
} from 'baileys';
import type { ILogger } from 'baileys/lib/Utils/logger.js';
import consola from 'consola';

const createBaileysLogger = (): ILogger => ({
	info(obj, msg) {
		consola.info(`[WhatsApp Bot [Baileys]]: ${JSON.stringify(obj)} ${msg}`);
	},
	error(obj, msg) {
		consola.error(`[WhatsApp Bot [Baileys]]: ${JSON.stringify(obj)} ${msg}`);
	},
	warn(obj, msg) {
		consola.warn(`[WhatsApp Bot [Baileys]]: ${JSON.stringify(obj)} ${msg}`);
	},
	debug(obj, msg) {
		consola.debug(`[WhatsApp Bot [Baileys]]: ${JSON.stringify(obj)} ${msg}`);
	},
	trace(obj, msg) {
		consola.trace(`[WhatsApp Bot [Baileys]]: ${JSON.stringify(obj)} ${msg}`);
	},
	child(obj) {
		return createBaileysLogger();
	},
	level: 'info',
});

const createBot = async () => {
	const authState = await useMultiFileAuthState(configEnv.SESSIONS_DIR);
	const socket = makeWASocket({
		auth: {
			creds: authState.state.creds,
			keys: makeCacheableSignalKeyStore(authState.state.keys, createBaileysLogger()),
		},
		browser: Browsers.windows('Chrome'),
		async cachedGroupMetadata(jid) {
			const data = await redisClient.get(`sangmata-group:${jid}`);
			if (data) {
				return jsonParse(data);
			}

			return undefined;
		},
		syncFullHistory: true,
		generateHighQualityLinkPreview: true,
		logger: createBaileysLogger(),
	});

	socket.ev.on('groups.update', async ([event]) => {
		if (!event.id) {
			return;
		}

		const metadata = await socket.groupMetadata(event.id);
		await redisClient.setex(
			`sangmata-group:${event.id}`,
			configEnv.TTL_CACHE_GROUPS,
			JSON.stringify(metadata),
		);
	});

	socket.ev.on('group-participants.update', async (event) => {
		if (!event.id) {
			return;
		}

		const metadata = await socket.groupMetadata(event.id);
		await redisClient.setex(
			`sangmata-group:${event.id}`,
			configEnv.TTL_CACHE_GROUPS,
			JSON.stringify(metadata),
		);
	});

	socket.ev.on('creds.update', authState.saveCreds);
	socket.ev.on('connection.update', async (update) => {
		// Always refresh the QR state
		await redisClient.del('sangmata-qr');

		if (update.connection === 'close') {
			const shouldReconnect =
				(update.lastDisconnect?.error as Boom)?.output.statusCode !==
				DisconnectReason.loggedOut;
			if (shouldReconnect) {
				createBot();
			}
		} else if (update.connection === 'open') {
			consola.info('[WhatsApp Bot] Client opened');
		} else if (update.qr) {
			await redisClient.setex('sangmata-qr', 60, update.qr);
		}
	});

	socket.ev.on('messages.upsert', ({ messages }) => upsertMessagesHandler(messages, socket));
	socket.ev.on('messages.update', (messages) => updateMessagesHandler(messages));
	socket.ev.on('messages.delete', (data) =>
		'keys' in data
			? deleteMessagesHandler(data.keys)
			: () => {
					// do nothing..
				},
	);
};

export const WhatsAppBot = async (): Promise<void> => {
	consola.info('[WhatsApp Bot] Starting engine...');
	await createBot();
};
