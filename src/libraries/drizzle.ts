import { configEnv } from '@/config/env.js';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as Schemas from '@/schemas/index.js';

export const db = drizzle({
	client: new Database(configEnv.SQLITE_DATABASE_URL),
	schema: Schemas,
});
