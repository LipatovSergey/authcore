import * as dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.test' });

export function createRedisTestClient() {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT);
  const db = Number(process.env.REDIS_DB);

  if (!host || Number.isNaN(port) || db !== 1) {
    throw new Error('Invalid Redis test configuration');
  }

  return new Redis({ host, port, db });
}
