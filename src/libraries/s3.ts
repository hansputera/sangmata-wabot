import { configEnv } from '@/config/env.js';
import * as AWS from '@aws-sdk/client-s3';

export const s3Client = new AWS.S3Client({
	endpoint: configEnv.S3_ENDPOINT,
	credentials: {
		accessKeyId: configEnv.S3_ACCESS_KEY,
		secretAccessKey: configEnv.S3_SECRET_KEY,
	},
	region: 'auto',
});
