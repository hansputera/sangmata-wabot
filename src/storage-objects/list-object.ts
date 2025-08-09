import { configEnv } from '@/config/env.js';
import { s3Client } from '@/libraries/s3.js';
import { ListObjectsCommand } from '@aws-sdk/client-s3';

export const listObjects = async (key: string) => {
	const command = new ListObjectsCommand({
		Bucket: configEnv.S3_BUCKET,
		Prefix: key,
	});

	const results = await s3Client.send(command);
	return results.Contents;
};
