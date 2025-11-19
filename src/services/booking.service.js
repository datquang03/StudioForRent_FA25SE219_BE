// #region Imports
import { Booking, Schedule, BookingDetail, RoomPolicy } from '../models/index.js';
import mongoose from 'mongoose';
import { NotFoundError, ValidationError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { BOOKING_STATUS, SCHEDULE_STATUS, USER_ROLES } from '../utils/constants.js';
import { createSchedule as createScheduleService, markScheduleBooked as markScheduleBookedService, freeSchedule as freeScheduleService } from './schedule.service.js';
import { createBookingDetails as createBookingDetailsService } from './bookingDetail.service.js';
import { Studio, Promotion } from '../models/index.js';
import { releaseEquipment } from './equipment.service.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import RoomPolicyService from './roomPolicy.service.js';
// #endregion

export const createBooking = async (data) => {
  const { userId } = data;
  if (!userId) throw new ValidationError('Missing userId');

  const session = await mongoose.startSession();
  try {
    let schedule = null;
    return await session.withTransaction(async () => {
      // Begin transactional scope

      // If scheduleId provided, use existing schedule
      if (data.scheduleId) {
        schedule = await Schedule.findById(data.scheduleId).session(session);
      
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
        // Pre-check for exact duplicate or overlapping schedules (respecting minimum gap)
        const MIN_GAP_MS = 30 * 60 * 1000;

        // Exact match
        const exact = await Schedule.findOne({ studioId, startTime: s, endTime: e }).session(session);
        if (exact) {
          if (exact.status !== SCHEDULE_STATUS.AVAILABLE) {
            throw new ConflictError('A schedule with the same time already exists and is not available');
          }
          schedule = exact;
        } else {
          // Check overlapping or too-close schedules
          const overlapping = await Schedule.findOne({
            studioId,
            startTime: { $lt: new Date(e.getTime() + MIN_GAP_MS) },
            endTime: { $gt: new Date(s.getTime() - MIN_GAP_MS) },
          }).session(session);

          if (overlapping) {
            // If overlapping schedule exists (even if status available) we must reject to keep MIN_GAP
            throw new ConflictError('Another schedule exists that overlaps or is within 30 minutes of the requested time');
          }

          // No conflicts — create a new schedule
          schedule = await createScheduleService({ studioId, startTime: s, endTime: e, status: SCHEDULE_STATUS.AVAILABLE }, session);
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

    const [bookingDoc] = await Booking.create([bookingData], { session });
    const booking = bookingDoc;

  // Mark schedule booked and link
    await markScheduleBookedService(schedule._id, booking._id, session);

  // Create booking details if provided, and compute totals (details + base studio price)
  let detailsTotal = 0;
    if (Array.isArray(data.details) && data.details.length > 0) {
      const { total } = await createBookingDetailsService(booking._id, data.details, session);
      detailsTotal = total;
    }

  // Compute base price from studio and duration
    const studio = await Studio.findById(schedule.studioId).session(session);
  if (!studio) {
    // rollback created resources
    await Booking.findByIdAndDelete(booking._id);
    try {
      await freeScheduleService(schedule._id);
    } catch (freeErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to free schedule after studio not found', freeErr);
    }
    throw new NotFoundError('Studio not found for schedule');
  }

  // Get global default policies (company-wide policies)
    const defaultCancellationPolicy = await RoomPolicy.findOne({
    type: 'CANCELLATION',
    category: 'STANDARD',
    isActive: true
    }).session(session);

    const defaultNoShowPolicy = await RoomPolicy.findOne({
    type: 'NO_SHOW',
    category: 'STANDARD',
    isActive: true
    }).session(session);

  if (!defaultCancellationPolicy || !defaultNoShowPolicy) {
    // rollback created resources
    await Booking.findByIdAndDelete(booking._id);
    try {
      await freeScheduleService(schedule._id);
    } catch (freeErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to free schedule during policy validation', freeErr);
    }
    throw new ValidationError('Default policies not configured. Please run seedPolicies.js first.');
  }

  // Create policy snapshots (immutable copy of global policies at booking time)
  booking.policySnapshots = {
    cancellation: {
      _id: defaultCancellationPolicy._id,
      name: defaultCancellationPolicy.name,
      type: defaultCancellationPolicy.type,
      category: defaultCancellationPolicy.category,
      refundTiers: defaultCancellationPolicy.refundTiers,
      isActive: defaultCancellationPolicy.isActive,
      createdAt: defaultCancellationPolicy.createdAt
    },
    noShow: {
      _id: defaultNoShowPolicy._id,
      name: defaultNoShowPolicy.name,
      type: defaultNoShowPolicy.type,
      category: defaultNoShowPolicy.category,
      noShowRules: defaultNoShowPolicy.noShowRules,
      isActive: defaultNoShowPolicy.isActive,
      createdAt: defaultNoShowPolicy.createdAt
    }
  };

  // Initialize financials
  booking.financials = {
    originalAmount: 0,
    refundAmount: 0,
    chargeAmount: 0,
    netAmount: 0
  };

  const durationMs = new Date(schedule.endTime).getTime() - new Date(schedule.startTime).getTime();
  const hours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100; // rounded to 2 decimals
  const baseTotal = (studio.basePricePerHour || 0) * hours;

  const totalBeforeDiscount = Math.round((baseTotal + detailsTotal) * 100) / 100;

  // Calculate discount: prefer promoId if provided and valid, otherwise use discountAmount from request
  let discountAmount = 0;
  if (data.promoId) {
    const promo = await Promotion.findById(data.promoId);
    if (promo && promo.isValid()) {
      discountAmount = promo.calculateDiscount(totalBeforeDiscount);
      // increment usage count
      promo.usageCount = (promo.usageCount || 0) + 1;
      await promo.save();
    } else {
      // invalid promo -> ignore
      discountAmount = 0;
    }
  } else {
    discountAmount = data.discountAmount || 0;
  }

    booking.totalBeforeDiscount = totalBeforeDiscount;
    booking.discountAmount = Math.round(discountAmount * 100) / 100;
    booking.finalAmount = Math.max(0, booking.totalBeforeDiscount - booking.discountAmount);
    await booking.save({ session });

  // Send notification to customer
  try {
    await createAndSendNotification(
      userId,
      NOTIFICATION_TYPE.CONFIRMATION,
      'Booking đã được tạo',
      `Booking của bạn đã được tạo thành công. Tổng tiền: ${booking.finalAmount.toLocaleString('vi-VN')} VND`,
      true, // Send email
      null, // io
      booking._id
    );
  } catch (notifyErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to send booking confirmation notification:', notifyErr);
  }

    return booking;
    }, { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' } });
  } finally {
    session.endSession();
  }
};

export const getBookingById = async (id) => {
  const booking = await Booking.findById(id).lean();
  if (!booking) throw new NotFoundError('Booking not found');

  // Attach booking details (if any)
  const details = await BookingDetail.find({ bookingId: booking._id }).lean();
  return { ...booking, details };
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

/**
 * Update a booking: change schedule times (validates duplicates), add/remove details, update promo
 * updateData may contain: startTime, endTime, addDetails (array), removeDetailIds (array), promoId
 */
export const updateBooking = async (bookingId, updateData, actorId, actorRole) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found');

  // Only allow updates when booking is in PENDING status
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new ConflictError('Only bookings in PENDING status can be updated');
  }

  // Only staff or admin can update bookings
  if (!actorRole || (actorRole !== USER_ROLES.STAFF && actorRole !== USER_ROLES.ADMIN)) {
    throw new UnauthorizedError('Only staff or admin can update bookings');
  }

  // Authorization: owner (customer) or staff/admin can update
  if (actorRole === 'customer' && String(booking.userId) !== String(actorId)) {
    throw new ValidationError('Not authorized to update this booking');
  }

  const useTransaction = Boolean(
    updateData.startTime || updateData.endTime ||
    (Array.isArray(updateData.addDetails) && updateData.addDetails.length > 0) ||
    (Array.isArray(updateData.removeDetailIds) && updateData.removeDetailIds.length > 0)
  );

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        // We will re-run the rest of the update flow using session-aware operations
        // 1) If schedule time update requested, validate via schedule service (this will throw if invalid)
        if (updateData.startTime || updateData.endTime) {
          const updatePayload = {};
          if (updateData.startTime) updatePayload.startTime = new Date(updateData.startTime);
          if (updateData.endTime) updatePayload.endTime = new Date(updateData.endTime);

          await (await import('./schedule.service.js')).updateSchedule(booking.scheduleId, updatePayload, session);
        }

        // 2) Handle removal of details (with session)
        let removedTotal = 0;
        if (Array.isArray(updateData.removeDetailIds) && updateData.removeDetailIds.length > 0) {
          const { removeBookingDetails } = await import('./bookingDetail.service.js');
          const res = await removeBookingDetails(bookingId, updateData.removeDetailIds, session);
          removedTotal = res.removedTotal || 0;
        }

        // 3) Handle addition of details (with session)
        let addedTotal = 0;
        if (Array.isArray(updateData.addDetails) && updateData.addDetails.length > 0) {
          const { createBookingDetails } = await import('./bookingDetail.service.js');
          const res = await createBookingDetails(bookingId, updateData.addDetails, session);
          addedTotal = res.total || 0;
        }

        // Continue with total recalculation and promo operations inside session
        const schedule = await Schedule.findById(booking.scheduleId).session(session);
        if (!schedule) throw new NotFoundError('Schedule not found');

        const studio = await (await import('../models/index.js')).Studio.findById(schedule.studioId).session(session);
        if (!studio) throw new NotFoundError('Studio not found');

        const durationMs = new Date(schedule.endTime).getTime() - new Date(schedule.startTime).getTime();
        const hours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100; // 2 decimals
        const baseTotal = (studio.basePricePerHour || 0) * hours;

        // Sum existing booking details remaining
        const details = await BookingDetail.find({ bookingId: booking._id }).session(session);
        const detailsTotal = details.reduce((acc, d) => acc + (d.subtotal || 0), 0);

        const totalBeforeDiscount = Math.round((baseTotal + detailsTotal) * 100) / 100;

        // Handle promo change (same code but keep within transaction)
        let discountAmount = 0;
        const PromotionModel = (await import('../models/index.js')).Promotion;

        if (updateData.promoId && String(updateData.promoId) !== String(booking.promoId || '')) {
          if (booking.promoId) {
            try {
              const oldPromo = await PromotionModel.findById(booking.promoId).session(session);
              if (oldPromo && oldPromo.usageCount > 0) {
                oldPromo.usageCount -= 1;
                await oldPromo.save({ session });
              }
            } catch (err) {
              console.error('Failed to decrement old promo usage', err);
            }
          }

          const newPromo = await PromotionModel.findById(updateData.promoId).session(session);
          if (newPromo && newPromo.isValid()) {
            discountAmount = newPromo.calculateDiscount(totalBeforeDiscount);
            newPromo.usageCount = (newPromo.usageCount || 0) + 1;
            await newPromo.save({ session });
            booking.promoId = newPromo._id;
          } else {
            booking.promoId = null;
          }
        } else if (updateData.promoId === null) {
          if (booking.promoId) {
            try {
              const oldPromo = await PromotionModel.findById(booking.promoId).session(session);
              if (oldPromo && oldPromo.usageCount > 0) {
                oldPromo.usageCount -= 1;
                await oldPromo.save({ session });
              }
            } catch (err) {
              console.error('Failed to decrement old promo usage', err);
            }
          }
          booking.promoId = null;
        } else if (booking.promoId) {
          const promo = await PromotionModel.findById(booking.promoId).session(session);
          if (promo && promo.isValid()) {
            discountAmount = promo.calculateDiscount(totalBeforeDiscount);
          }
        } else {
          discountAmount = updateData.discountAmount || booking.discountAmount || 0;
        }

        booking.totalBeforeDiscount = totalBeforeDiscount;
        booking.discountAmount = Math.round(discountAmount * 100) / 100;
        booking.finalAmount = Math.max(0, booking.totalBeforeDiscount - booking.discountAmount);

        await booking.save({ session });
        return booking;
      }, { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' } });
    } finally {
      session.endSession();
    }
  }

  // 1) If schedule time update requested, validate via schedule service (this will throw if invalid)
  if (updateData.startTime || updateData.endTime) {
    const updatePayload = {};
    if (updateData.startTime) updatePayload.startTime = new Date(updateData.startTime);
    if (updateData.endTime) updatePayload.endTime = new Date(updateData.endTime);

    try {
      await (await import('./schedule.service.js')).updateSchedule(booking.scheduleId, updatePayload);
    } catch (err) {
      // Do not modify booking if schedule update fails
      throw err;
    }
  }

  // 2) Handle removal of details
  let removedTotal = 0;
  if (Array.isArray(updateData.removeDetailIds) && updateData.removeDetailIds.length > 0) {
    const { removeBookingDetails } = await import('./bookingDetail.service.js');
    const res = await removeBookingDetails(bookingId, updateData.removeDetailIds);
    removedTotal = res.removedTotal || 0;
  }

  // 3) Handle addition of details
  let addedTotal = 0;
  if (Array.isArray(updateData.addDetails) && updateData.addDetails.length > 0) {
    const { createBookingDetails } = await import('./bookingDetail.service.js');
    const res = await createBookingDetails(bookingId, updateData.addDetails);
    addedTotal = res.total || 0;
  }

  // 4) Recalculate totals: compute base price + sum(details)
  const schedule = await Schedule.findById(booking.scheduleId);
  if (!schedule) throw new NotFoundError('Schedule not found');

  const studio = await (await import('../models/index.js')).Studio.findById(schedule.studioId);
  if (!studio) throw new NotFoundError('Studio not found');

  const durationMs = new Date(schedule.endTime).getTime() - new Date(schedule.startTime).getTime();
  const hours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100; // 2 decimals
  const baseTotal = (studio.basePricePerHour || 0) * hours;

  // Sum existing booking details remaining
  const details = await BookingDetail.find({ bookingId: booking._id });
  const detailsTotal = details.reduce((acc, d) => acc + (d.subtotal || 0), 0);

  const totalBeforeDiscount = Math.round((baseTotal + detailsTotal) * 100) / 100;

  // 5) Handle promo change
  let discountAmount = 0;
  const PromotionModel = (await import('../models/index.js')).Promotion;

  // If promo changed, adjust usage counts
  if (updateData.promoId && String(updateData.promoId) !== String(booking.promoId || '')) {
    // decrement old promo usageCount if present
    if (booking.promoId) {
      try {
        const oldPromo = await PromotionModel.findById(booking.promoId);
        if (oldPromo && oldPromo.usageCount > 0) {
          oldPromo.usageCount -= 1;
          await oldPromo.save();
        }
      } catch (err) {
        // log and continue
        // eslint-disable-next-line no-console
        console.error('Failed to decrement old promo usage', err);
      }
    }

    const newPromo = await PromotionModel.findById(updateData.promoId);
    if (newPromo && newPromo.isValid()) {
      discountAmount = newPromo.calculateDiscount(totalBeforeDiscount);
      newPromo.usageCount = (newPromo.usageCount || 0) + 1;
      await newPromo.save();
      booking.promoId = newPromo._id;
    } else {
      // invalid promo -> clear
      booking.promoId = null;
    }
  } else if (updateData.promoId === null) {
    // explicit removal of promo
    if (booking.promoId) {
      try {
        const oldPromo = await PromotionModel.findById(booking.promoId);
        if (oldPromo && oldPromo.usageCount > 0) {
          oldPromo.usageCount -= 1;
          await oldPromo.save();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to decrement old promo usage', err);
      }
    }
    booking.promoId = null;
  } else if (booking.promoId) {
    const promo = await PromotionModel.findById(booking.promoId);
    if (promo && promo.isValid()) {
      discountAmount = promo.calculateDiscount(totalBeforeDiscount);
    }
  } else {
    // fallback to discountAmount provided in updateData
    discountAmount = updateData.discountAmount || booking.discountAmount || 0;
  }

  booking.totalBeforeDiscount = totalBeforeDiscount;
  booking.discountAmount = Math.round(discountAmount * 100) / 100;
  booking.finalAmount = Math.max(0, booking.totalBeforeDiscount - booking.discountAmount);

  await booking.save();

  return booking;
};

export const cancelBooking = async (bookingId) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new NotFoundError('Booking not found');

      if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
        throw new ConflictError('Booking cannot be cancelled');
      }

      // Calculate refund using policy snapshot
      let refundResult = null;
      if (booking.policySnapshots?.cancellation && booking.scheduleId) {
        try {
          const schedule = await Schedule.findById(booking.scheduleId).session(session);
          refundResult = RoomPolicyService.calculateRefund(
            booking.policySnapshots.cancellation,
            new Date(schedule.startTime),
            new Date(), // cancellation time = now
            booking.finalAmount
          );

          // Update financials
          booking.financials.originalAmount = booking.finalAmount;
          booking.financials.refundAmount = refundResult.refundAmount;
          booking.financials.netAmount = booking.finalAmount - refundResult.refundAmount;

          // Add cancellation event
          booking.events.push({
            type: 'CANCELLED',
            timestamp: new Date(),
            details: {
              refundPercentage: refundResult.refundPercentage,
              tier: refundResult.tier,
              hoursBeforeBooking: refundResult.hoursBeforeBooking
            },
            amount: refundResult.refundAmount
          });

        } catch (policyError) {
          // Log policy calculation error but don't block cancellation
          console.error('Failed to calculate refund:', policyError);
        }
      }

      booking.status = BOOKING_STATUS.CANCELLED;
      await booking.save({ session });

      // free schedule if linked
      if (booking.scheduleId) {
        try {
          await freeScheduleService(booking.scheduleId, session);
        } catch (freeErr) {
          // eslint-disable-next-line no-console
          console.error('Failed to free schedule on cancellation', freeErr);
          throw freeErr;
        }

        // Release reserved equipment from booking details (if any)
        try {
          const details = await BookingDetail.find({ bookingId: booking._id, detailType: 'equipment' }).session(session);
          for (const d of details) {
            try {
              await releaseEquipment(d.equipmentId, d.quantity, session);
            } catch (releaseErr) {
              // Log and continue; do not block cancellation if release fails
              // eslint-disable-next-line no-console
              console.error('Failed to release equipment on cancellation', releaseErr);
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to query booking details for release', err);
        }
      }

      return booking;
    });
  } finally {
    session.endSession();
  }
};

export const markAsNoShow = async (bookingId, checkInTime = null) => {
  const booking = await Booking.findById(bookingId).populate('scheduleId');
  if (!booking) throw new NotFoundError('Booking not found');

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new ConflictError('Only confirmed bookings can be marked as no-show');
  }

  // Calculate no-show charge using policy snapshot
  let chargeResult = null;
  if (booking.policySnapshots?.noShow && booking.scheduleId) {
    try {
      // Count previous no-shows for this user (simplified - in real app might need more complex logic)
      const previousNoShows = await Booking.countDocuments({
        userId: booking.userId,
        'events.type': 'NO_SHOW',
        _id: { $ne: booking._id }
      });

      chargeResult = RoomPolicyService.calculateNoShowCharge(
        booking.policySnapshots.noShow,
        new Date(booking.scheduleId.startTime),
        checkInTime ? new Date(checkInTime) : null,
        booking.finalAmount,
        previousNoShows
      );

      // Update financials
      booking.financials.originalAmount = booking.finalAmount;
      booking.financials.chargeAmount = chargeResult.chargeAmount;
      booking.financials.netAmount = chargeResult.chargeAmount; // Amount to charge

      // Add no-show event
      booking.events.push({
        type: 'NO_SHOW',
        timestamp: new Date(),
        details: {
          chargeType: chargeResult.chargeType,
          chargePercentage: chargeResult.chargePercentage,
          minutesLate: chargeResult.minutesLate,
          previousNoShowCount: chargeResult.previousNoShowCount,
          forgiven: chargeResult.forgiven,
          isNoShow: chargeResult.isNoShow
        },
        amount: chargeResult.chargeAmount
      });

    } catch (policyError) {
      // Log policy calculation error but don't block no-show marking
      console.error('Failed to calculate no-show charge:', policyError);
    }
  }

  booking.status = BOOKING_STATUS.COMPLETED; // Mark as completed with no-show
  await booking.save();

  // Send notification about no-show
  try {
    const chargeText = chargeResult?.chargeAmount > 0
      ? `Bạn sẽ bị tính phí ${chargeResult.chargeAmount.toLocaleString('vi-VN')} VND do no-show.`
      : 'Không có phí no-show được áp dụng.';

    await createAndSendNotification(
      booking.userId,
      NOTIFICATION_TYPE.WARNING,
      'No-show được ghi nhận',
      `Booking của bạn đã được đánh dấu là no-show. ${chargeText}`,
      true, // Send email
      null, // io
      booking._id
    );
  } catch (notifyErr) {
    console.error('Failed to send no-show notification:', notifyErr);
  }

  return booking;
};

export const confirmBooking = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found');
  booking.status = BOOKING_STATUS.CONFIRMED;
  await booking.save();

  // Send notification to customer
  try {
    await createAndSendNotification(
      booking.userId,
      NOTIFICATION_TYPE.CONFIRMATION,
      'Booking đã được xác nhận',
      `Booking của bạn đã được xác nhận bởi staff. Vui lòng chuẩn bị đến đúng giờ.`,
      true, // Send email
      null, // io
      booking._id
    );
  } catch (notifyErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to send confirmation notification:', notifyErr);
  }

  return booking;
};

export default {
  createBooking,
  getBookingById,
  getBookings,
  updateBooking,
  cancelBooking,
  markAsNoShow,
  confirmBooking,
};
