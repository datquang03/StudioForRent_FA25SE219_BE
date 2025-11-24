/**
 * Redis helpers for caching and idempotency
 * 
 * Note: This is a placeholder implementation that works without Redis.
 * For production with Redis, install redis package and configure connection.
 */

import logger from './logger.js';

// In-memory fallback for idempotency keys (not suitable for multi-instance deployments)
const memoryStore = new Map();

/**
 * Check if Redis is available and connected
 * @returns {boolean} - True if Redis is available, false otherwise
 */
export const isRedisAvailable = () => {
  // Redis is not configured in this application
  // This returns false to indicate fallback to in-memory storage
  return false;
};

/**
 * Claim an idempotency key to prevent duplicate processing
 * 
 * @param {string} key - The idempotency key to claim
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean|null>} 
 *   - true: key was successfully claimed (first time)
 *   - false: key already exists (duplicate)
 *   - null: Redis not available, unable to claim
 */
export const claimIdempotencyKey = async (key, ttlSeconds = 30) => {
  try {
    if (!isRedisAvailable()) {
      // Fallback to in-memory store for development/testing
      logger.debug(`Using in-memory fallback for idempotency key: ${key}`);
      
      // Check if key exists
      if (memoryStore.has(key)) {
        logger.debug(`Idempotency key already exists (duplicate): ${key}`);
        return false;
      }
      
      // Claim the key with TTL
      memoryStore.set(key, {
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      });
      
      // Auto-cleanup after TTL
      setTimeout(() => {
        memoryStore.delete(key);
        logger.debug(`Idempotency key expired and removed: ${key}`);
      }, ttlSeconds * 1000);
      
      logger.debug(`Idempotency key claimed successfully: ${key}`);
      return true;
    }
    
    // TODO: Implement Redis-based idempotency when Redis is configured
    // Example Redis implementation:
    // const claimed = await redisClient.set(key, '1', {
    //   NX: true,  // Only set if key doesn't exist
    //   EX: ttlSeconds  // Expiration time
    // });
    // return claimed === 'OK';
    
    return null;
    
  } catch (error) {
    logger.error('Error in claimIdempotencyKey:', error);
    throw error;
  }
};

/**
 * Release an idempotency key manually (optional)
 * @param {string} key - The idempotency key to release
 * @returns {Promise<boolean>} - True if key was deleted, false otherwise
 */
export const releaseIdempotencyKey = async (key) => {
  try {
    if (!isRedisAvailable()) {
      const existed = memoryStore.has(key);
      memoryStore.delete(key);
      logger.debug(`Idempotency key released: ${key}`);
      return existed;
    }
    
    // TODO: Implement Redis-based release
    // return await redisClient.del(key) === 1;
    
    return false;
  } catch (error) {
    logger.error('Error in releaseIdempotencyKey:', error);
    return false;
  }
};

/**
 * Clear all idempotency keys (for testing/cleanup)
 * WARNING: Use with caution!
 */
export const clearAllIdempotencyKeys = () => {
  const count = memoryStore.size;
  memoryStore.clear();
  logger.info(`Cleared ${count} idempotency keys from memory store`);
  return count;
};

// Periodic cleanup of expired keys from in-memory store
if (!isRedisAvailable()) {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of memoryStore.entries()) {
      if (now - value.timestamp > value.ttl) {
        memoryStore.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Periodic cleanup: removed ${cleaned} expired idempotency keys`);
    }
  }, 60000); // Check every minute
}

export default {
  isRedisAvailable,
  claimIdempotencyKey,
  releaseIdempotencyKey,
  clearAllIdempotencyKeys
};
