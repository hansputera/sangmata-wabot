import { configEnv } from '@/config/env.js';
import { s3Client } from '@/libraries/s3.js';
import { Upload } from '@aws-sdk/lib-storage';
import consola from 'consola';
import type { Transform } from 'node:stream';

export const uploadObjectStream = async (
	path: string,
	stream: Transform,
) => {
	try {
		const s3Upload = new Upload({
			client: s3Client,
			params: {
				Bucket: configEnv.S3_BUCKET,
				Body: stream,
				Key: path,
			},
			partSize: 1024 * 1024 * 5,
			queueSize: 4,
		});

		s3Upload.on('httpUploadProgress', (progress) => {
			consola.warn(
				`[UploadObject] Uploading ${path} about ${progress.loaded} of ${progress.total}`,
			);
		});

		await s3Upload.done();
	} catch (e) {
		consola.error(`[UploadObject] Failed upload ${path} because ${(e as Error).message}`);
	}
};
