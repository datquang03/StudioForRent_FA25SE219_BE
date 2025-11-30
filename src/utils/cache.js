import { getRedis, isRedisConnected } from '../config/redis.js';
import logger from './logger.js';

const memoryCache = new Map();

// Key prefix for Redis keys
const KEY_PREFIX = 'app:cache:';

// TTL configs (can be overridden by env)
const DEFAULT_TTL_SECONDS = parseInt(process.env.REDIS_CACHE_TTL || '300'); // 5 minutes default

const cleanupInterval = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) memoryCache.delete(k);
  }
}, cleanupInterval);

export const cacheGet = async (key) => {
  const redisKey = `${KEY_PREFIX}${key}`;
  try {
    if (getRedis() && isRedisConnected()) {
      const client = getRedis();
      const raw = await client.get(redisKey);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    }

    const entry = memoryCache.get(redisKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(redisKey);
      return null;
    }
    return entry.value;
  } catch (err) {
    logger.warn('cacheGet error', { key, error: err?.message || err });
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const redisKey = `${KEY_PREFIX}${key}`;
  try {
    if (getRedis() && isRedisConnected()) {
      const client = getRedis();
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      await client.setEx(redisKey, ttlSeconds, raw);
      return true;
    }

    memoryCache.set(redisKey, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  } catch (err) {
    logger.warn('cacheSet error', { key, error: err?.message || err });
    return false;
  }
};

export default { cacheGet, cacheSet };
