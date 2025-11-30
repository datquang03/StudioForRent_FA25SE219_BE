import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client = null;
let connected = false;

// Monitoring interval (logs status every 5 minutes)
const MONITOR_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(async () => {
  try {
    if (client && connected) {
      const info = await client.info();
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const keyCount = await client.dbsize();
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      
      logger.info('Redis monitoring', {
        connected: true,
        memoryUsed: memoryMatch ? parseInt(memoryMatch[1]) : 'unknown',
        keyCount,
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 'unknown'
      });
    } else {
      logger.warn('Redis monitoring: disconnected');
    }
  } catch (err) {
    logger.error('Redis monitoring error', { error: err?.message || err });
  }
}, MONITOR_INTERVAL);

export const getRedis = () => {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = createClient({ 
    url,
    socket: {
      connectTimeout: 5000, // 5s connect timeout
      commandTimeout: 2000, // 2s command timeout
    },
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.error('Redis connection refused');
        return new Error('Redis connection failed');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        logger.error('Redis retry time exhausted');
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        logger.error('Redis retry attempts exhausted');
        return undefined;
      }
      // Exponential backoff
      return Math.min(options.attempt * 100, 3000);
    }
  });

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

  client.on('end', () => {
    connected = false;
    logger.warn('Redis client disconnected');
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
