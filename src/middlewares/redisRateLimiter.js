import { getRedis, isRedisConnected } from '../config/redis.js';
import logger from '../utils/logger.js';

// In-memory fallback store
const memoryStore = new Map();

// Key prefix for Redis keys
const KEY_PREFIX = 'app:ratelimit:';

// TTL configs (can be overridden by env)
const DEFAULT_TTL_SECONDS = parseInt(process.env.REDIS_RATE_TTL || '900'); // 15 minutes default

const cleanupInterval = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.expiresAt <= now) memoryStore.delete(k);
  }
}, cleanupInterval);

/**
 * Create a lightweight Redis-backed rate limiter middleware.
 * - Uses INCR+EX in Redis when available (works on free tiers)
 * - Falls back to in-memory map when Redis not available (single-instance).
 *
 * options: { windowMs, max, keyGenerator }
 */
export const createRedisRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, keyGenerator = (req) => req.ip } = {}) => {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  return async (req, res, next) => {
    const key = keyGenerator(req) || req.ip || 'anon';
    const redisKey = `${KEY_PREFIX}${key}`;

    try {
      if (getRedis() && isRedisConnected()) {
        const client = getRedis();
        // atomic increment
        const current = await client.incr(redisKey);
        if (Number(current) === 1) {
          // first hit, set expiry
          await client.expire(redisKey, ttlSeconds);
        }

        if (Number(current) > max) {
          const ttl = await client.ttl(redisKey);
          res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau!', retryAfter: ttl || ttlSeconds });
          return;
        }
        return next();
      }

      // Fallback in-memory store (best-effort)
      const now = Date.now();
      const entry = memoryStore.get(redisKey);
      if (!entry || entry.expiresAt <= now) {
        memoryStore.set(redisKey, { count: 1, expiresAt: now + ttlSeconds * 1000 });
        return next();
      }

      entry.count += 1;
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.expiresAt - now) / 1000);
        res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau!', retryAfter });
        return;
      }
      memoryStore.set(redisKey, entry);
      return next();
    } catch (err) {
      logger.warn('Redis rate limiter error, falling back to next()', { error: err?.message || err });
      return next();
    }
  };
};

export default createRedisRateLimiter;
