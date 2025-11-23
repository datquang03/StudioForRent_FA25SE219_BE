import cron from 'node-cron';
import logger from '../utils/logger.js';
import Booking from '../models/Booking/booking.model.js';
import { BOOKING_STATUS } from '../utils/constants.js';
import { markAsNoShow } from '../services/booking.service.js';

const NO_SHOW_GRACE_MINUTES = Number(process.env.NO_SHOW_GRACE_MINUTES || '30');
const SCHEDULE = process.env.NO_SHOW_CRON_SCHEDULE || '*/5 * * * *'; // every 5 minutes

export const initNoShowJob = (io = null) => {
  logger.info(`Initializing no-show job: schedule=${SCHEDULE}, grace=${NO_SHOW_GRACE_MINUTES} minutes`);

  cron.schedule(SCHEDULE, async () => {
    try {
      logger.info('Running no-show detection job');
      const now = Date.now();
      const graceMs = NO_SHOW_GRACE_MINUTES * 60 * 1000;

      const candidates = await Booking.find({
        checkInAt: { $exists: false },
        status: BOOKING_STATUS.CONFIRMED,
      }).populate('scheduleId').limit(200);

      for (const b of candidates) {
        try {
          const start = b.scheduleId?.startTime ? new Date(b.scheduleId.startTime).getTime() : null;
          if (!start) continue;
          if (now > (start + graceMs)) {
            logger.info(`Marking booking ${b._id} as no-show (start ${new Date(start).toISOString()})`);
            await markAsNoShow(b._id, null, io);
          }
        } catch (err) {
          logger.error(`Error processing booking ${b._id} in no-show job: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error('No-show job failed:', err);
    }
  });
};

export default initNoShowJob;
