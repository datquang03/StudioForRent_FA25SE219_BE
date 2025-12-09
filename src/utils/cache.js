import NodeCache from 'node-cache';
import logger from './logger.js';

// Initialize In-Memory Cache
// stdTTL: 300 seconds (5 minutes) default
// checkperiod: 60 seconds (cleanup interval)
const memoryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Key prefix for cache keys
const KEY_PREFIX = 'app:cache:';

/**
 * Get value from In-Memory Cache
 * @param {string} key 
 * @returns {Promise<any>}
 */
export const cacheGet = async (key) => {
  const cacheKey = `${KEY_PREFIX}${key}`;
  try {
    const value = memoryCache.get(cacheKey);
    if (value === undefined) return null;
    return value;
  } catch (err) {
    logger.warn('cacheGet error', { key, error: err?.message || err });
    return null;
  }
};

/**
 * Set value to In-Memory Cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>}
 */
export const cacheSet = async (key, value, ttlSeconds = 300) => {
  const cacheKey = `${KEY_PREFIX}${key}`;
  try {
    return memoryCache.set(cacheKey, value, ttlSeconds);
  } catch (err) {
    logger.warn('cacheSet error', { key, error: err?.message || err });
    return false;
  }
};

export default { cacheGet, cacheSet };
