import {defineConfig} from 'drizzle-kit';
import {configEnv} from './src/config/env';

export default defineConfig({
    dialect: 'sqlite',
    schema: './src/schemas',
    dbCredentials: {
        url: configEnv.SQLITE_DATABASE_URL,
    },
});
