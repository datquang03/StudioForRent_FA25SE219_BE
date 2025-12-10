import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client = null;
let connected = false;

// Monitoring interval (logs status every 5 minutes)
const MONITOR_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(async () => {
  try {
    if (client && client.isOpen && client.isReady) {
      const info = await client.info();
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const keyCount = await client.dbSize();
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      
      logger.info('Redis monitoring', {
        connected: true,
        memoryUsed: memoryMatch ? parseInt(memoryMatch[1]) : 'unknown',
        keyCount,
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 'unknown'
      });
    } else {
      // Only log if we expected it to be connected but it's not
      if (connected) {
        logger.warn('Redis monitoring: Client is not ready', { 
          isOpen: client?.isOpen, 
          isReady: client?.isReady,
          connectedVar: connected 
        });
      }
    }
  } catch (err) {
    // Enhanced error logging
    logger.error('Redis monitoring error', { 
      message: err?.message || 'Unknown error', 
      stack: err?.stack,
      name: err?.name,
      code: err?.code 
    });
  }
}, MONITOR_INTERVAL);

const createRedisClient = () => {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = createClient({ 
    url,
    socket: {
      connectTimeout: 5000, // 5s connect timeout
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          logger.error('Redis retry attempts exhausted');
          return new Error('Redis retry attempts exhausted');
        }
        // Exponential backoff with cap
        return Math.min(retries * 100, 3000);
      }
    }
  });

  client.on('error', (err) => {
    connected = false;
    logger.error('Redis client error', { error: err?.message || err });
  });

  client.on('connect', () => {
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

  return client;
};

export const connectRedis = async () => {
  const redisClient = createRedisClient();
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.warn('Could not connect to Redis (non-fatal). Continuing without Redis.', { error: err?.message || err });
    }
  }
  return redisClient;
};

export const getRedis = () => {
  if (!client) {
    return createRedisClient();
  }
  return client;
};

export const isRedisConnected = () => connected;
