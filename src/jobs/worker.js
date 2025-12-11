#!/usr/bin/env node
// Worker entrypoint to start background jobs (no-show, reminders, etc.)
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import connectDB from '../config/db.js';
import { connectRedis } from '../config/redis.js';
import initNoShowJob from './noShowJob.js';
import initScheduleReminders from './scheduleReminderJob.js';
import { Emitter } from "@socket.io/redis-emitter";
import { createClient } from "redis";

dotenv.config();

const start = async () => {
  try {
    // Check if this instance should run jobs
    if (process.env.RUN_JOBS !== 'true') {
      logger.info('Skipping jobs worker (RUN_JOBS is not true)');
      return;
    }

    logger.info('Starting jobs worker');

    // Connect to Database
    await connectDB();

    // Connect to Redis (for caching/general use)
    await connectRedis();

    // Setup Redis Emitter for Socket.io
    let ioEmitter = null;
    if (process.env.REDIS_URL) {
      try {
        const redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.on('error', (err) => logger.error('Redis Emitter Client Error', err));
        await redisClient.connect();
        ioEmitter = new Emitter(redisClient);
        logger.info('Redis Emitter initialized for worker');
      } catch (redisErr) {
        logger.error('Failed to initialize Redis Emitter:', redisErr);
      }
    }

    // Initialize no-show job with emitter
    initNoShowJob(ioEmitter);

    // Initialize reminder scheduler with emitter
    initScheduleReminders(ioEmitter);

    logger.info('Jobs worker started');
  } catch (err) {
    logger.error('Failed to start jobs worker:', err);
    process.exit(1);
  }
};

start();
