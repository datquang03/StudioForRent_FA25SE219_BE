import logger from './logger.js';
import { getRedis, isRedisConnected } from '../config/redis.js';

// In-memory fallback for idempotency keys (used when Redis is not available)
const memoryStore = new Map();

/**
 * Check if Redis is available and connected
 * @returns {boolean}
 */
export const isRedisAvailable = () => {
  try {
    return Boolean(getRedis() && isRedisConnected());
  } catch (err) {
    return false;
  }
};

/**
 * Claim an idempotency key. Returns:
 *  - true: successfully claimed (proceed)
 *  - false: key already exists (duplicate)
 *  - null: redis not available (fallback)
 */
export const claimIdempotencyKey = async (key, ttlSeconds = 30) => {
  try {
    if (isRedisAvailable()) {
      const client = getRedis();
      // SET key value NX EX ttl
      const res = await client.set(key, '1', { NX: true, EX: ttlSeconds });
      return res === 'OK';
    }

    // In-memory fallback (not suitable for multi-instance production)
    if (memoryStore.has(key)) return false;
    memoryStore.set(key, { timestamp: Date.now(), ttl: ttlSeconds * 1000 });
    setTimeout(() => memoryStore.delete(key), ttlSeconds * 1000);
    return true;
  } catch (err) {
    logger.warn('claimIdempotencyKey failed, falling back to null', { key, error: err?.message || err });
    return null;
  }
};

export const releaseIdempotencyKey = async (key) => {
  try {
    if (isRedisAvailable()) {
      const client = getRedis();
      await client.del(key);
      return true;
    }

    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    return existed;
  } catch (err) {
    logger.warn('releaseIdempotencyKey failed', { key, error: err?.message || err });
    return false;
  }
};

export const clearAllIdempotencyKeys = () => {
  const count = memoryStore.size;
  memoryStore.clear();
  logger.info(`Cleared ${count} idempotency keys from memory store`);
  return count;
};

// Periodic cleanup of expired keys
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (now - v.timestamp > v.ttl) memoryStore.delete(k);
  }
}, 60000);

export default {
  isRedisAvailable,
  claimIdempotencyKey,
  releaseIdempotencyKey,
  clearAllIdempotencyKeys,
};
