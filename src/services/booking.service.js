// #region Imports
import { Booking, Schedule } from '../models/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { BOOKING_STATUS } from '../utils/constants.js';
// #endregion

export const createBooking = async (data) => {
  const { userId, scheduleId } = data;
  if (!userId || !scheduleId) {
    throw new ValidationError('Missing userId or scheduleId');
  }

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError('Schedule not found');
  if (schedule.status !== 'available' && schedule.status !== BOOKING_STATUS.PENDING) {
    // allow pending as a fallback, but prefer explicit available
    throw new ConflictError('Schedule is not available');
  }

  const bookingData = {
    userId,
    scheduleId,
    totalBeforeDiscount: data.totalBeforeDiscount || 0,
    discountAmount: data.discountAmount || 0,
    finalAmount: data.finalAmount || 0,
    promoId: data.promoId,
    payType: data.payType,
    notes: data.notes,
    status: BOOKING_STATUS.PENDING,
  };

  const booking = await Booking.create(bookingData);

  // link schedule -> booking
  schedule.status = BOOKING_STATUS.PENDING === BOOKING_STATUS.PENDING ? 'booked' : 'booked';
  schedule.bookingId = booking._id;
  await schedule.save();

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
