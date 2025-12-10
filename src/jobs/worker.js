#!/usr/bin/env node
// Worker entrypoint to start background jobs (no-show, reminders, etc.)
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import connectDB from '../config/db.js';
import { connectRedis } from '../config/redis.js';
import initNoShowJob from './noShowJob.js';
import initScheduleReminders from './scheduleReminderJob.js';

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

    // Connect to Redis
    await connectRedis();

    // Initialize no-show job
    initNoShowJob();

    // Initialize reminder scheduler
    initScheduleReminders();

    logger.info('Jobs worker started');
  } catch (err) {
    logger.error('Failed to start jobs worker:', err);
    process.exit(1);
  }
};

start();
