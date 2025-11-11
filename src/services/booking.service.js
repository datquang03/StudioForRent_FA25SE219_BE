// #region Imports
import { Booking, Schedule } from '../models/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { BOOKING_STATUS, SCHEDULE_STATUS } from '../utils/constants.js';
import { createSchedule as createScheduleService, markScheduleBooked as markScheduleBookedService, freeSchedule as freeScheduleService } from './schedule.service.js';
import { createBookingDetails as createBookingDetailsService } from './bookingDetail.service.js';
// #endregion

export const createBooking = async (data) => {
  const { userId } = data;
  if (!userId) throw new ValidationError('Missing userId');

  let schedule = null;

  // If scheduleId provided, use existing schedule
  if (data.scheduleId) {
    schedule = await Schedule.findById(data.scheduleId);
    if (!schedule) throw new NotFoundError('Schedule not found');
    if (![SCHEDULE_STATUS.AVAILABLE, BOOKING_STATUS.PENDING].includes(schedule.status)) {
      throw new ConflictError('Schedule is not available');
    }
  } else {
    // Expect schedule details: studioId, startTime, endTime
    const { studioId, startTime, endTime } = data;
    if (!studioId || !startTime || !endTime) {
      throw new ValidationError('Missing schedule info: studioId, startTime, endTime');
    }

    const s = new Date(startTime);
    const e = new Date(endTime);
    if (!(e > s)) throw new ValidationError('endTime must be greater than startTime');

    // Try to find exact matching schedule (same studio and times)
    schedule = await Schedule.findOne({ studioId, startTime: s, endTime: e });

    if (schedule) {
      // Found an existing schedule; ensure it's available
      if (![SCHEDULE_STATUS.AVAILABLE, BOOKING_STATUS.PENDING].includes(schedule.status)) {
        throw new ConflictError('Existing schedule is not available');
      }
    } else {
      // Create a new schedule (this will check for overlaps and throw on conflict)
      schedule = await createScheduleService({ studioId, startTime: s, endTime: e, status: SCHEDULE_STATUS.AVAILABLE });
    }
  }

  // Create booking
  const bookingData = {
    userId,
    scheduleId: schedule._id,
    totalBeforeDiscount: data.totalBeforeDiscount || 0,
    discountAmount: data.discountAmount || 0,
    finalAmount: data.finalAmount || 0,
    promoId: data.promoId,
    payType: data.payType,
    notes: data.notes,
    status: BOOKING_STATUS.PENDING,
  };

  const booking = await Booking.create(bookingData);

  // Mark schedule booked and link
  try {
    await markScheduleBookedService(schedule._id, booking._id);
  } catch (err) {
    // If marking failed, rollback booking
    await Booking.findByIdAndDelete(booking._id);
    throw err;
  }

  // If booking details provided, create them and calculate totals
  if (Array.isArray(data.details) && data.details.length > 0) {
    try {
      const { total } = await createBookingDetailsService(booking._id, data.details);

      // Update booking totals based on details
      booking.totalBeforeDiscount = total;
      booking.discountAmount = data.discountAmount || 0;
      booking.finalAmount = Math.max(0, total - booking.discountAmount);
      await booking.save();
    } catch (err) {
      // rollback: free schedule and delete booking
      try {
        await freeScheduleService(schedule._id);
      } catch (freeErr) {
        // log and continue
        // eslint-disable-next-line no-console
        console.error('Failed to free schedule during rollback', freeErr);
      }
      await Booking.findByIdAndDelete(booking._id);
      throw err;
    }
  }

  return booking;
};

export const getBookingById = async (id) => {
  const booking = await Booking.findById(id).lean();
  if (!booking) throw new NotFoundError('Booking not found');
  return booking;
};

export const getBookings = async ({ userId, page = 1, limit = 20, status } = {}) => {
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 200);
  const query = {};
  if (userId) query.userId = userId;
  if (status) query.status = status;

  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Booking.countDocuments(query),
  ]);

  return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) };
};

export const cancelBooking = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found');

  if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
    throw new ConflictError('Booking cannot be cancelled');
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  await booking.save();

  // free schedule if linked
  if (booking.scheduleId) {
    const schedule = await Schedule.findById(booking.scheduleId);
    if (schedule) {
      schedule.status = 'available';
      schedule.bookingId = null;
      await schedule.save();
    }
  }

  return booking;
};

export const confirmBooking = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found');
  booking.status = BOOKING_STATUS.CONFIRMED;
  await booking.save();
  return booking;
};

export default {
  createBooking,
  getBookingById,
  getBookings,
  cancelBooking,
  confirmBooking,
};
