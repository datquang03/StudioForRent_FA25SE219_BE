import { getRedis, isRedisConnected } from '../config/redis.js';
import logger from './logger.js';

// In-memory fallback for locks (single-instance only)
const memoryLocks = new Map();

// Key prefix for Redis keys
const KEY_PREFIX = 'app:lock:';

// TTL configs (can be overridden by env)
const DEFAULT_TTL_SECONDS = parseInt(process.env.REDIS_LOCK_TTL || '30'); // 30 seconds default

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Acquire a lock for a key. Returns token string if acquired, otherwise null.
 * Uses SET key token NX EX ttl for atomicity in Redis.
 */
export const acquireLock = async (key, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const redisKey = `${KEY_PREFIX}${key}`;
  try {
    if (getRedis() && isRedisConnected()) {
      const client = getRedis();
      const token = makeToken();
      const res = await client.set(redisKey, token, { NX: true, EX: ttlSeconds });
      if (res === 'OK') return token;
      return null;
    }

    // Fallback single-instance lock
    if (memoryLocks.has(redisKey)) return null;
    const token = makeToken();
    memoryLocks.set(redisKey, token);
    setTimeout(() => memoryLocks.delete(redisKey), ttlSeconds * 1000);
    return token;
  } catch (err) {
    logger.warn('acquireLock error, failing open', { key, error: err?.message || err });
    return null;
  }
};

/**
 * Release a lock safely using token compare-and-delete.
 */
export const releaseLock = async (key, token) => {
  const redisKey = `${KEY_PREFIX}${key}`;
  try {
    if (getRedis() && isRedisConnected()) {
      const client = getRedis();
      const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
      const res = await client.eval(script, { keys: [redisKey], arguments: [token] });
      return res === 1;
    }

    const existing = memoryLocks.get(redisKey);
    if (existing && existing === token) {
      memoryLocks.delete(redisKey);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn('releaseLock error', { key, error: err?.message || err });
    return false;
  }
};

export default { acquireLock, releaseLock };
