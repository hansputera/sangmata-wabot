import { configEnv } from '@/config/env.js';
import { db } from '@/libraries/drizzle.js';
import { redisClient } from '@/libraries/redis.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono/quick';
import qrcode from 'qrcode';
import ejs from 'ejs';
import { listObjects } from '@/storage-objects/list-object.js';

export const RestApi = async () => {
	const app = new Hono();

	app.get('/images', async (ctx) => {
		const images = await listObjects('images/');
		const result = await ejs.renderFile('views/images.ejs', {
			images:
				images?.map((img) => ({
					...img,
					bucketUrl: configEnv.S3_URL,
				})) ?? [],
		});

		return ctx.html(result);
	});

	app.get('/qr', async (ctx) => {
		const currentQr = await redisClient.get('sangmata-qr');
		if (!currentQr) {
			return ctx.body('QR not available', 404);
		}

		const qrUrl = await qrcode.toDataURL(currentQr).catch(() => undefined);
		if (!qrUrl) {
			return ctx.body('QR URL not valid', 500);
		}

		return ctx.html(`<img src="${qrUrl}" />`);
	});

	app.get('/messages', async (ctx) => {
		const messages = await db.query.messages.findMany({
			orderBy: (msgs, { desc }) => desc(msgs.createdAt),
		});
		return ctx.json({
			data: messages,
		});
	});

	serve({
		fetch: app.fetch,
		port: configEnv.PORT,
		hostname: configEnv.HOST,
	});
};
