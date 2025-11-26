#!/usr/bin/env node
// Job wrapper for schedule reminders — keeps jobs under src/jobs/
import logger from '../utils/logger.js';
import { scheduleReminders } from '../services/notification.service.js';

const initScheduleReminders = () => {
  try {
    logger.info('Initializing schedule reminder job');
    scheduleReminders();
  } catch (err) {
    logger.error('Failed to initialize schedule reminder job:', err);
  }
};

export default initScheduleReminders;
