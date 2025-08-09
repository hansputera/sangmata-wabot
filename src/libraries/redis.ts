import { configEnv } from '@/config/env.js';
import consola from 'consola';
import { Redis } from 'ioredis';

export const redisClient = new Redis(configEnv.REDIS_URI);

redisClient.on('error', consola.error);
redisClient.on('close', () => consola.warn('[Redis] closed'));
