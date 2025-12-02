// #region Imports
import { Booking, Schedule, BookingDetail, RoomPolicy, Payment } from '../models/index.js';
import mongoose from 'mongoose';
import { NotFoundError, ValidationError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { BOOKING_STATUS, SCHEDULE_STATUS, USER_ROLES, PAYMENT_STATUS } from '../utils/constants.js';
import { createSchedule as createScheduleService, markScheduleBooked as markScheduleBookedService, freeSchedule as freeScheduleService } from './schedule.service.js';
import { createBookingDetails as createBookingDetailsService } from './bookingDetail.service.js';
import { Studio, Promotion } from '../models/index.js';
import { releaseEquipment } from './equipment.service.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import RoomPolicyService from './roomPolicy.service.js';
import { createPaymentOptions } from './payment.service.js';
import { acquireLock, releaseLock } from '../utils/redisLock.js';
import { sendNoShowEmail } from './email.service.js';
// #endregion

// #region Core CRUD Operations

export const createBooking = async (data) => {
  const { userId } = data;
  if (!userId) throw new ValidationError('ID người dùng là bắt buộc');

  // Acquire lock to prevent concurrent bookings for the same schedule/slot
  let lockKey;
  let lockToken = null;
  if (data.scheduleId) {
    lockKey = `booking:schedule:${data.scheduleId}`;
  } else {
    const { studioId, startTime, endTime } = data;
    if (!studioId || !startTime || !endTime) {
      throw new ValidationError('Thiếu thông tin lịch: studioId, startTime, endTime là bắt buộc');
    }
    const s = new Date(startTime);
    const e = new Date(endTime);
    lockKey = `booking:studio:${studioId}:${s.getTime()}:${e.getTime()}`;
  }

  lockToken = await acquireLock(lockKey);
  if (!lockToken) {
    throw new ConflictError('Lịch đang được đặt bởi người dùng khác. Vui lòng thử lại.');
  }

  const session = await mongoose.startSession();
  try {
    let schedule = null;
    return await session.withTransaction(async () => {
      // Begin transactional scope

      // If scheduleId provided, use existing schedule
      if (data.scheduleId) {
        schedule = await Schedule.findById(data.scheduleId).session(session);
      
        if (!schedule) throw new NotFoundError('Lịch không tồn tại');
        if (![SCHEDULE_STATUS.AVAILABLE, BOOKING_STATUS.PENDING].includes(schedule.status)) {
          throw new ConflictError('Lịch không còn trống');
        }
      } else {
        // Expect schedule details: studioId, startTime, endTime
        const { studioId, startTime, endTime } = data;

        const s = new Date(startTime);
        const e = new Date(endTime);
        if (!(e > s)) throw new ValidationError('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
        // Pre-check for exact duplicate or overlapping schedules (respecting minimum gap)
        const MIN_GAP_MS = 30 * 60 * 1000;

        // Exact match
        const exact = await Schedule.findOne({ studioId, startTime: s, endTime: e }).session(session);
        if (exact) {
          if (exact.status !== SCHEDULE_STATUS.AVAILABLE) {
            throw new ConflictError('Lịch cùng thời gian đã tồn tại và không còn trống');
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
            throw new ConflictError('Lịch bị trùng hoặc quá gần với lịch khác (khoảng cách tối thiểu 30 phút)');
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
        throw new NotFoundError('Studio không tồn tại cho lịch này');
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
        throw new ValidationError('Chính sách mặc định chưa được cấu hình. Vui lòng chạy seedPolicies.js trước.');
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

      // Create payment options
      let paymentOptions = [];
      try {
        paymentOptions = await createPaymentOptions(booking._id);
      } catch (paymentErr) {
        // Log error but don't fail booking creation
        console.error('Failed to create payment options:', paymentErr);
      }

      return { booking, paymentOptions };
    }, { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' } });
  } finally {
    session.endSession();
    // Release lock
    if (lockToken) {
      await releaseLock(lockKey, lockToken);
    }
  }
};

export const getBookingById = async (id, userId = null, userRole = null) => {
  // Build query with authorization check
  const query = { _id: id };
  
  // If customer, only allow viewing their own bookings
  if (userRole === 'customer' && userId) {
    query.userId = userId;
  }

  const booking = await Booking.findOne(query)
    .populate({
      path: 'userId',
      select: 'fullName username phone email'
    })
    .populate({
      path: 'scheduleId',
      populate: {
        path: 'studioId',
        select: 'name location area capacity basePricePerHour'
      }
    })
    .populate('promoId', 'name code discountPercentage discountAmount')
    .lean()
    .maxTimeMS(5000); // Add timeout to prevent slow queries

  if (!booking) throw new NotFoundError('Booking không tồn tại');

  // Attach booking details (if any) with limit to prevent memory issues
  const details = await BookingDetail.find({ bookingId: booking._id })
    .limit(100) // Limit to prevent memory issues
    .populate('equipmentId', 'name description pricePerHour pricePerDay')
    .populate('extraServiceId', 'name description pricePerHour pricePerDay')
    .lean()
    .maxTimeMS(3000);

  // Format the response similar to getActiveBookingsForStaff
  const formattedBooking = {
    _id: booking._id,
    customer: booking.userId ? {
      _id: booking.userId._id,
      fullName: booking.userId.fullName,
      username: booking.userId.username,
      phone: booking.userId.phone,
      email: booking.userId.email
    } : null,
    studio: booking.scheduleId?.studioId ? {
      _id: booking.scheduleId.studioId._id,
      name: booking.scheduleId.studioId.name,
      location: booking.scheduleId.studioId.location,
      area: booking.scheduleId.studioId.area,
      capacity: booking.scheduleId.studioId.capacity,
      basePricePerHour: booking.scheduleId.studioId.basePricePerHour
    } : null,
    schedule: booking.scheduleId ? {
      _id: booking.scheduleId._id,
      startTime: booking.scheduleId.startTime,
      endTime: booking.scheduleId.endTime,
      duration: Math.round((new Date(booking.scheduleId.endTime) - new Date(booking.scheduleId.startTime)) / (1000 * 60 * 60) * 10) / 10,
      date: booking.scheduleId.startTime.toISOString().split('T')[0],
      timeRange: `${new Date(booking.scheduleId.startTime).toTimeString().slice(0, 5)} - ${new Date(booking.scheduleId.endTime).toTimeString().slice(0, 5)}`
    } : null,
    totalBeforeDiscount: booking.totalBeforeDiscount,
    discountAmount: booking.discountAmount,
    finalAmount: booking.finalAmount,
    status: booking.status,
    payType: booking.payType,
    promotion: booking.promoId ? {
      _id: booking.promoId._id,
      name: booking.promoId.name,
      code: booking.promoId.code,
      discountPercentage: booking.promoId.discountPercentage,
      discountAmount: booking.promoId.discountAmount
    } : null,
    details: details.map(detail => ({
      _id: detail._id,
      detailType: detail.detailType,
      description: detail.description,
      quantity: detail.quantity,
      pricePerUnit: detail.pricePerUnit,
      subtotal: detail.subtotal,
      equipment: detail.equipmentId ? {
        _id: detail.equipmentId._id,
        name: detail.equipmentId.name,
        description: detail.equipmentId.description,
        pricePerHour: detail.equipmentId.pricePerHour,
        pricePerDay: detail.equipmentId.pricePerDay
      } : null,
      service: detail.extraServiceId ? {
        _id: detail.extraServiceId._id,
        name: detail.extraServiceId.name,
        description: detail.extraServiceId.description,
        pricePerHour: detail.extraServiceId.pricePerHour,
        pricePerDay: detail.extraServiceId.pricePerDay
      } : null
    })),
    policySnapshots: booking.policySnapshots,
    events: booking.events,
    financials: booking.financials,
    notes: booking.notes,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    checkInAt: booking.checkInAt,
    checkOutAt: booking.checkOutAt
  };

  return formattedBooking;
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
  if (!booking) throw new NotFoundError('Booking không tồn tại');

  // Only allow updates when booking is in PENDING status
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new ConflictError('Chỉ booking ở trạng thái PENDING mới có thể cập nhật');
  }

  // Only staff or admin can update bookings
  if (!actorRole || (actorRole !== USER_ROLES.STAFF && actorRole !== USER_ROLES.ADMIN)) {
    throw new UnauthorizedError('Chỉ staff hoặc admin mới có thể cập nhật booking');
  }

  // Authorization: owner (customer) or staff/admin can update
  if (actorRole === 'customer' && String(booking.userId) !== String(actorId)) {
    throw new ValidationError('Không có quyền cập nhật booking này');
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
        if (!schedule) throw new NotFoundError('Lịch không tồn tại');

        const studio = await (await import('../models/index.js')).Studio.findById(schedule.studioId).session(session);
        if (!studio) throw new NotFoundError('Studio không tồn tại');

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
  if (!schedule) throw new NotFoundError('Lịch không tồn tại');

  const studio = await (await import('../models/index.js')).Studio.findById(schedule.studioId);
  if (!studio) throw new NotFoundError('Studio không tồn tại');

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
      if (!booking) throw new NotFoundError('Booking không tồn tại');

      if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
        throw new ConflictError('Booking không thể hủy');
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

// #endregion

// #region Workflow Actions

export const confirmBooking = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking không tồn tại');
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

/**
 * Check-in booking (only staff should call controller-layer)
 * Preconditions:
 * - Booking must exist
 * - At least 30% of finalAmount must be completed (paid)
 * - Idempotent: if already checked-in, return booking
 */
export const checkInBooking = async (bookingId, actorId = null) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new NotFoundError('Booking không tồn tại');

      // If already checked-in, return
      if (booking.checkInAt) {
        return booking;
      }

      // Ensure sufficient payment (>=30%)
      const paidPayments = await Payment.find({
        bookingId: booking._id,
        status: PAYMENT_STATUS.PAID
      }).select('amount').session(session);

      const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const required = Math.round(booking.finalAmount * 0.3);
      if (totalPaid < required) {
        throw new ValidationError('Cần thanh toán tối thiểu 30% trước khi check-in');
      }

      // Update booking status and checkInAt
      booking.checkInAt = new Date();
      booking.status = BOOKING_STATUS.CHECKED_IN;
      // record event
      booking.events = booking.events || [];
      booking.events.push({ type: 'CHECK_IN', timestamp: new Date(), actorId });

      await booking.save({ session });

      // Optionally mark schedule as in-use (delegated to schedule service if exists)
      try {
        const { markScheduleInUse } = await import('./schedule.service.js');
        if (typeof markScheduleInUse === 'function') {
          await markScheduleInUse(booking.scheduleId, session);
        }
      } catch (e) {
        // ignore if schedule service doesn't support it
      }

      // Send notification (best-effort)
      try {
        await (await import('./notification.service.js')).createAndSendNotification(
          booking.userId,
          'CHECKIN',
          'Bạn đã được check-in',
          `Booking ${booking._id} đã được check-in lúc ${booking.checkInAt}`,
          true,
          null,
          booking._id
        );
      } catch (notifyErr) {
        // log + continue
        // eslint-disable-next-line no-console
        console.error('Failed to send check-in notification', notifyErr);
      }

      return booking;
    });
  } finally {
    session.endSession();
  }
};

/**
 * Check-out booking (only staff should call controller-layer)
 * Preconditions:
 * - Booking must exist
 * - If already checked-out, idempotent return
 * - On checkout, release equipment and mark schedule free/completed
 */
export const checkOutBooking = async (bookingId, actorId = null) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new NotFoundError('Booking không tồn tại');

      if (booking.checkOutAt) {
        return booking;
      }

      booking.checkOutAt = new Date();

      // If wasn't confirmed, mark as completed
      booking.status = BOOKING_STATUS.COMPLETED;
      booking.events = booking.events || [];
      booking.events.push({ type: 'CHECK_OUT', timestamp: new Date(), actorId });

      await booking.save({ session });

      // Release equipment reserved in booking details
      try {
        const BookingDetail = (await import('../models/Booking/bookingDetail.model.js')).default;
        const details = await BookingDetail.find({ bookingId: booking._id, detailType: 'equipment' }).session(session);
        for (const d of details) {
          try {
            await (await import('./equipment.service.js')).releaseEquipment(d.equipmentId, d.quantity, session);
          } catch (releaseErr) {
            // log and continue
            // eslint-disable-next-line no-console
            console.error('Failed to release equipment on checkout', releaseErr);
          }
        }
      } catch (e) {
        // ignore if model/service shape differs
      }

      // Optionally free schedule (delegate)
      try {
        const { freeSchedule } = await import('./schedule.service.js');
        if (typeof freeSchedule === 'function') {
          await freeSchedule(booking.scheduleId, session);
        }
      } catch (e) {
        // ignore
      }

      // Send notification (best-effort)
      try {
        await (await import('./notification.service.js')).createAndSendNotification(
          booking.userId,
          'CHECKOUT',
          'Bạn đã checkout',
          `Booking ${booking._id} đã checkout lúc ${booking.checkOutAt}`,
          true,
          null,
          booking._id
        );
      } catch (notifyErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to send check-out notification', notifyErr);
      }

      return booking;
    });
  } finally {
    session.endSession();
  }
};

export const markAsNoShow = async (bookingId, checkInTime = null, io = null) => {
  const booking = await Booking.findById(bookingId).populate('scheduleId');
  if (!booking) throw new NotFoundError('Booking không tồn tại');

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new ConflictError('Chỉ booking đã xác nhận mới có thể đánh dấu no-show');
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

  // Send notification about no-show (in-app + email + realtime if io provided)
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
      io, // io for real-time
      booking._id
    );

    // Send dedicated no-show email template (best-effort)
    try {
      const user = await (await import('../models/index.js')).User.findById(booking.userId).select('email name');
      if (user && user.email) {
        await sendNoShowEmail(user.email, {
          bookingId: booking._id,
          date: booking.scheduleId?.startTime ? new Date(booking.scheduleId.startTime).toLocaleDateString('vi-VN') : undefined,
          time: booking.scheduleId?.startTime ? new Date(booking.scheduleId.startTime).toLocaleTimeString('vi-VN') : undefined,
          chargeAmount: chargeResult?.chargeAmount || 0
        });
      }
    } catch (emailErr) {
      // log and continue
      // eslint-disable-next-line no-console
      console.error('Failed to send dedicated no-show email:', emailErr);
    }
  } catch (notifyErr) {
    console.error('Failed to send no-show notification:', notifyErr);
  }

  return booking;
};

// #endregion

// #region Specialized Operations

export const getBookingsForStaff = async ({ page = 1, limit = 20, status, startDate, endDate, includeAll = false } = {}) => {
  // Validate pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 200);
  const skip = (safePage - 1) * safeLimit;
  
  // 1. Validate và chuẩn bị filters
  const { validStartDate, validEndDate } = validateDates(startDate, endDate);
  
  const matchConditions = {};
  const statusFilter = buildStatusFilter(status, includeAll);
  if (statusFilter) matchConditions.status = statusFilter;
  
  const dateFilter = buildDateFilter(validStartDate, validEndDate);
  const dateMatch = dateFilter ? { 'schedule.startTime': dateFilter } : null;

  // 2. Xây dựng aggregation pipeline
  const basePipeline = [
    { $match: matchConditions },
    ...buildLookupStages(),
    ...(dateMatch ? [{ $match: dateMatch }] : [])
  ];

  const dataPipeline = [
    ...basePipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: safeLimit }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: 'total' }
  ];

  // 3. Thực thi queries song song
  const [bookingsResult, countResult] = await Promise.all([
    Booking.aggregate(dataPipeline).option({ allowDiskUse: true, maxTimeMS: 10000 }),
    Booking.aggregate(countPipeline).option({ allowDiskUse: true, maxTimeMS: 5000 })
  ]);

  const total = countResult[0]?.total || 0;

  // 4. Format kết quả trả về
  const formattedBookings = bookingsResult.map(formatBookingResponse);

  return {
    bookings: formattedBookings,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
    filters: {
      status: matchConditions.status || null,
      dateRange: {
        startDate: validStartDate ? validStartDate.toISOString() : null,
        endDate: validEndDate ? validEndDate.toISOString() : null
      },
      includeAll: includeAll || false
    }
  };
};

// #endregion

// #region Helper Functions

// Helper function: Validate dates
const validateDates = (startDate, endDate) => {
  let validStartDate = null;
  let validEndDate = null;
  
  if (startDate) {
    validStartDate = new Date(startDate);
    if (isNaN(validStartDate.getTime())) {
      throw new ValidationError('Định dạng startDate không hợp lệ');
    }
  }
  
  if (endDate) {
    validEndDate = new Date(endDate);
    if (isNaN(validEndDate.getTime())) {
      throw new ValidationError('Định dạng endDate không hợp lệ');
    }
  }
  
  return { validStartDate, validEndDate };
};

// Helper function: Build status filter
const buildStatusFilter = (status, includeAll) => {
  if (includeAll) {
    // Allow filtering by any status or get all
    if (status) {
      return Array.isArray(status) ? { $in: status } : status;
    }
    return null; // No filter
  }
  
  // Default: only active bookings
  const activeStatuses = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN];
  if (status) {
    const statusArray = Array.isArray(status) ? status : [status];
    const validStatuses = statusArray.filter(s => activeStatuses.includes(s));
    return validStatuses.length > 0 ? { $in: validStatuses } : { $in: activeStatuses };
  }
  return { $in: activeStatuses };
};

// Helper function: Build date filter
const buildDateFilter = (validStartDate, validEndDate) => {
  if (!validStartDate && !validEndDate) return null;
  
  const dateFilter = {};
  if (validStartDate) dateFilter.$gte = validStartDate;
  if (validEndDate) dateFilter.$lte = validEndDate;
  return dateFilter;
};

// Helper function: Build lookup stages
const buildLookupStages = () => {
  return [
    // Join với Schedule để lấy thông tin thời gian
    { $lookup: { from: 'schedules', localField: 'scheduleId', foreignField: '_id', as: 'schedule' } },
    { $unwind: { path: '$schedule', preserveNullAndEmptyArrays: false } },
    
    // Join với User để lấy thông tin khách hàng
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: false } },
    
    // Join với Studio để lấy thông tin phòng
    { $lookup: { from: 'studios', localField: 'schedule.studioId', foreignField: '_id', as: 'studio' } },
    { $unwind: { path: '$studio', preserveNullAndEmptyArrays: false } },
    
    // Join với Promotion (optional)
    { $lookup: { from: 'promotions', localField: 'promoId', foreignField: '_id', as: 'promotion' } },
    { $unwind: { path: '$promotion', preserveNullAndEmptyArrays: true } }
  ];
};

// Helper function: Calculate schedule details
const calculateScheduleDetails = (schedule) => {
  const startTime = new Date(schedule.startTime);
  const endTime = new Date(schedule.endTime);
  const durationInHours = Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10;
  
  return {
    _id: schedule._id,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    duration: durationInHours,
    date: startTime.toISOString().split('T')[0],
    timeRange: `${startTime.toTimeString().slice(0, 5)} - ${endTime.toTimeString().slice(0, 5)}`
  };
};

// Helper function: Format booking response
const formatBookingResponse = (booking) => {
  return {
    _id: booking._id,
    customer: {
      _id: booking.customer._id,
      fullName: booking.customer.fullName,
      username: booking.customer.username,
      phone: booking.customer.phone,
      email: booking.customer.email
    },
    studio: {
      _id: booking.studio._id,
      name: booking.studio.name,
      location: booking.studio.location,
      area: booking.studio.area,
      capacity: booking.studio.capacity,
      basePricePerHour: booking.studio.basePricePerHour
    },
    schedule: calculateScheduleDetails(booking.schedule),
    totalBeforeDiscount: booking.totalBeforeDiscount,
    discountAmount: booking.discountAmount,
    finalAmount: booking.finalAmount,
    status: booking.status,
    payType: booking.payType,
    promotion: booking.promotion ? {
      _id: booking.promotion._id,
      name: booking.promotion.name,
      code: booking.promotion.code,
      discountPercentage: booking.promotion.discountPercentage,
      discountAmount: booking.promotion.discountAmount
    } : null,
    createdAt: booking.createdAt,
    checkInAt: booking.checkInAt,
    checkOutAt: booking.checkOutAt
  };
};

// #endregion

export default {
  createBooking,
  getBookingById,
  getBookings,
  updateBooking,
  cancelBooking,
  markAsNoShow,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  getBookingsForStaff,
};
