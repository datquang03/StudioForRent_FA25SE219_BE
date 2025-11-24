#!/usr/bin/env node
// Worker entrypoint to start background jobs (no-show, reminders, etc.)
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import initNoShowJob from './noShowJob.js';
import initScheduleReminders from './scheduleReminderJob.js';

dotenv.config();

const start = async () => {
  try {
    logger.info('Starting jobs worker');

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
