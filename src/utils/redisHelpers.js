import logger from './logger.js';
import { getRedis, isRedisConnected } from '../config/redis.js';

// In-memory fallback for idempotency keys (used when Redis is not available)
const memoryStore = new Map();

// Circuit breaker for Redis
let circuitBreaker = {
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  lastFailureTime: 0,
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 60000, // 1 minute to try again
  successCount: 0,
  successThreshold: 2 // Close after 2 successes in HALF_OPEN
};

const checkCircuitBreaker = () => {
  const now = Date.now();
  if (circuitBreaker.state === 'OPEN') {
    if (now - circuitBreaker.lastFailureTime > circuitBreaker.recoveryTimeout) {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successCount = 0;
      logger.info('Circuit breaker: HALF_OPEN - attempting recovery');
    }
    return false;
  }
  return circuitBreaker.state === 'CLOSED' || circuitBreaker.state === 'HALF_OPEN';
};

const recordSuccess = () => {
  if (circuitBreaker.state === 'HALF_OPEN') {
    circuitBreaker.successCount++;
    if (circuitBreaker.successCount >= circuitBreaker.successThreshold) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.failureCount = 0;
      logger.info('Circuit breaker: CLOSED - recovered');
    }
  } else if (circuitBreaker.state === 'CLOSED') {
    circuitBreaker.failureCount = 0;
  }
};

const recordFailure = () => {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
    circuitBreaker.state = 'OPEN';
    logger.warn('Circuit breaker: OPEN - too many failures');
  }
};

/**
 * Check if Redis is available and connected, considering circuit breaker
 * @returns {boolean}
 */
export const isRedisAvailable = () => {
  try {
    return checkCircuitBreaker() && Boolean(getRedis() && isRedisConnected());
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
      recordSuccess();
      return res === 'OK';
    }

    // In-memory fallback (not suitable for multi-instance production)
    if (memoryStore.has(key)) return false;
    memoryStore.set(key, { timestamp: Date.now(), ttl: ttlSeconds * 1000 });
    setTimeout(() => memoryStore.delete(key), ttlSeconds * 1000);
    return true;
  } catch (err) {
    recordFailure();
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
