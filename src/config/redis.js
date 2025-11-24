import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client = null;
let connected = false;

export const getRedis = () => {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = createClient({ url });

  client.on('error', (err) => {
    connected = false;
    logger.error('Redis client error', { error: err?.message || err });
  });

  client.on('connect', () => {
    connected = true;
    logger.info('Redis client connecting');
  });

  client.on('ready', () => {
    connected = true;
    logger.info('Redis client ready');
  });

  // attempt to connect but don't crash if it fails; callers should handle failures
  (async () => {
    try {
      await client.connect();
    } catch (err) {
      logger.warn('Could not connect to Redis (non-fatal). Continuing without Redis.', { error: err?.message || err });
    }
  })();

  return client;
};

export const isRedisConnected = () => connected;
