import { getRedis, isRedisConnected } from '../config/redis.js';
import logger from './logger.js';

/**
 * Try to claim an idempotency key. Returns:
 * - true: successfully claimed (proceed)
 * - false: key already exists (duplicate)
 * - null: redis not available (fallback)
 */
export const claimIdempotencyKey = async (key, ttlSeconds = 30) => {
  try {
    const client = getRedis();
    if (!client || !isRedisConnected()) return null;

    // SET key value NX EX ttl
    const res = await client.set(key, '1', { NX: true, EX: ttlSeconds });
    return res === 'OK';
  } catch (err) {
    logger.warn('Redis claimIdempotencyKey failed, falling back to null', { key, error: err?.message || err });
    return null;
  }
};

export const releaseIdempotencyKey = async (key) => {
  try {
    const client = getRedis();
    if (!client || !isRedisConnected()) return;
    await client.del(key);
  } catch (err) {
    logger.warn('Redis releaseIdempotencyKey failed', { key, error: err?.message || err });
  }
};

export const isRedisAvailable = () => isRedisConnected();
