import { cleanEnv, str, url, num, port, host } from 'envalid';

export const configEnv = cleanEnv(process.env, {
	SESSIONS_DIR: str(),
	REDIS_URI: url(),
	PHONE_NUMBER: str(),
	PORT: port({ default: 4000 }),
	HOST: host({ default: '0.0.0.0' }),

	S3_ENDPOINT: url(),
	S3_BUCKET: str(),
	S3_ACCESS_KEY: str(),
	S3_SECRET_KEY: str(),

	SQLITE_DATABASE_URL: str(),

	TTL_CACHE_GROUPS: num({
		default: 60 * 5,
	}),
});
