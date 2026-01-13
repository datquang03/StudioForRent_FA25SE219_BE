import mongoose from 'mongoose';
import Refund from '../models/Refund/refund.model.js';
import Payment from '../models/Payment/payment.model.js';
import Booking from '../models/Booking/booking.model.js';
import { PAYMENT_STATUS, BOOKING_STATUS } from '../utils/constants.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import RoomPolicyService from './roomPolicy.service.js';
import Schedule from '../models/Schedule/schedule.model.js';

// #region Helper Functions

/**
 * Calculate refund amount based on total paid and cancellation policy
 * @param {string} bookingId - Booking ID
 * @returns {object} { totalPaid, refundPercentage, refundAmount }
 */
export const calculateRefundAmount = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Booking không tồn tại');
  }

  // Get all PAID payments for this booking
  const paidPayments = await Payment.find({ bookingId, status: PAYMENT_STATUS.PAID });
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  if (totalPaid === 0) {
    return { totalPaid: 0, refundPercentage: 0, refundAmount: 0 };
  }

  // Calculate refund percentage from policy
  let refundPercentage = 0;
  if (booking.policySnapshots?.cancellation && booking.scheduleId) {
    try {
      const schedule = await Schedule.findById(booking.scheduleId);
      if (schedule) {
        const result = RoomPolicyService.calculateRefund(
          booking.policySnapshots.cancellation,
          new Date(schedule.startTime),
          new Date(),
          totalPaid
        );
        refundPercentage = result.refundPercentage || 0;
      }
    } catch (err) {
      logger.error('Failed to calculate refund policy:', err);
    }
  }

  const refundAmount = Math.round(totalPaid * (refundPercentage / 100));

  return { totalPaid, refundPercentage, refundAmount };
};

// #endregion

// #region Customer Functions

/**
 * Create refund request for a booking (Customer action)
 * @param {string} bookingId - Booking ID to refund
 * @param {object} opts - Options object
 * @param {string} opts.bankName - Bank name (e.g., "Vietcombank", "MB Bank") - REQUIRED
 * @param {string} opts.accountNumber - Customer bank account number - REQUIRED
 * @param {string} opts.accountName - Account holder name - REQUIRED
 * @param {string} opts.reason - Customer's reason for refund (optional)
 * @param {string} opts.userId - ID of customer creating request
 * @returns {object} Refund information
 */
export const createRefundRequest = async (bookingId, opts = {}) => {
  const { bankName, accountNumber, accountName, reason, userId } = opts;

  // Validate bank info
  if (!bankName || !accountNumber || !accountName) {
    throw new ValidationError('Thông tin ngân hàng (bankName, accountNumber, accountName) là bắt buộc');
  }

  // Validate booking
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Booking không tồn tại');
  }

  // Booking must be CANCELLED
  if (booking.status !== BOOKING_STATUS.CANCELLED) {
    throw new ValidationError('Chỉ có thể yêu cầu hoàn tiền cho booking đã hủy');
  }

  // Check if refund already exists
  const existingRefund = await Refund.findOne({ 
    bookingId, 
    status: { $in: ['PENDING_APPROVAL', 'PENDING', 'PROCESSING', 'APPROVED'] } 
  });
  if (existingRefund) {
    throw new ValidationError('Yêu cầu hoàn tiền đã tồn tại cho booking này');
  }

  // Calculate refund amount
  const { totalPaid, refundPercentage, refundAmount } = await calculateRefundAmount(bookingId);

  if (refundAmount === 0) {
    throw new ValidationError('Không có số tiền để hoàn lại (có thể do hủy muộn hoặc chưa thanh toán)');
  }

  // Create refund request
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Use customer's reason if provided, otherwise generate default
    const refundReason = reason 
      ? reason 
      : `Hoàn tiền booking - ${refundPercentage}% theo chính sách`;

    const refund = await Refund.create([{
      bookingId,
      amount: refundAmount,
      reason: refundReason,
      requestedBy: userId,
      status: 'PENDING_APPROVAL',
      destinationBank: {
        bankName: bankName,
        accountNumber: accountNumber,
        accountName: accountName
      }
    }], { session });

    await session.commitTransaction();

    logger.info('Refund request created', { 
      refundId: refund[0]._id, 
      bookingId, 
      amount: refundAmount 
    });

    return {
      ...refund[0].toObject(),
      totalPaid,
      refundPercentage
    };
  } catch (err) {
    await session.abortTransaction();
    if (err?.code === 11000) {
      throw new ValidationError('Yêu cầu hoàn tiền đã tồn tại cho booking này');
    }
    throw err;
  } finally {
    session.endSession();
  }
};

// #endregion

// #region Staff/Admin Functions

/**
 * Get all pending refund requests (Staff/Admin)
 */
export const getPendingRefunds = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [refunds, total] = await Promise.all([
    Refund.find({ status: 'PENDING_APPROVAL' })
      .populate('bookingId', 'finalAmount scheduleId userId')
      .populate('requestedBy', 'fullName username email')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit),
    Refund.countDocuments({ status: 'PENDING_APPROVAL' })
  ]);

  return {
    refunds,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

/**
 * Approve a refund request (Staff/Admin action)
 * Changes status to APPROVED - Staff will then manually transfer money
 * @param {string} refundId - Refund ID to approve
 * @param {string} staffId - Staff user ID
 */
export const approveRefund = async (refundId, staffId) => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new NotFoundError('Yêu cầu hoàn tiền không tồn tại');
  }

  if (refund.status !== 'PENDING_APPROVAL') {
    throw new ValidationError(`Không thể phê duyệt yêu cầu ở trạng thái ${refund.status}`);
  }

  // Validate bank info exists
  if (!refund.destinationBank?.bankName || !refund.destinationBank?.accountNumber) {
    throw new ValidationError('Thiếu thông tin ngân hàng');
  }

  // Update status to APPROVED - waiting for manual transfer
  refund.status = 'APPROVED';
  refund.approvedBy = staffId;
  refund.approvedAt = new Date();
  await refund.save();

  // Send notification to customer about approval
  try {
    const booking = await Booking.findById(refund.bookingId);
    if (booking?.userId) {
      await createAndSendNotification(
        booking.userId,
        NOTIFICATION_TYPE.SUCCESS,
        'Yêu cầu hoàn tiền đã được duyệt',
        `Yêu cầu hoàn tiền ${refund.amount.toLocaleString()} VND đã được phê duyệt. Tiền sẽ được chuyển trong vòng 24-48 giờ.`,
        false,
        null,
        refund._id
      );
    }
  } catch (notifErr) {
    logger.error('Failed to send approval notification:', notifErr);
  }

  logger.info('Refund approved', { refundId, staffId });

  return refund;
};

/**
 * Reject a refund request (Staff/Admin action)
 * @param {string} refundId - Refund ID to reject
 * @param {string} staffId - Staff user ID
 * @param {string} reason - Rejection reason
 */
export const rejectRefund = async (refundId, staffId, reason) => {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Lý do từ chối là bắt buộc');
  }

  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new NotFoundError('Yêu cầu hoàn tiền không tồn tại');
  }

  if (refund.status !== 'PENDING_APPROVAL') {
    throw new ValidationError(`Không thể từ chối yêu cầu ở trạng thái ${refund.status}`);
  }

  refund.status = 'REJECTED';
  refund.approvedBy = staffId;
  refund.approvedAt = new Date();
  refund.rejectionReason = reason.trim();
  await refund.save();

  // Notify customer
  try {
    const booking = await Booking.findById(refund.bookingId);
    if (booking?.userId) {
      await createAndSendNotification(
        booking.userId,
        NOTIFICATION_TYPE.ERROR,
        'Yêu cầu hoàn tiền bị từ chối',
        `Yêu cầu hoàn tiền ${refund.amount.toLocaleString()} VND đã bị từ chối. Lý do: ${reason}`,
        false,
        null,
        refund._id
      );
    }
  } catch (notifErr) {
    logger.error('Failed to send rejection notification:', notifErr);
  }

  logger.info('Refund rejected', { refundId, staffId, reason });

  return refund;
};

// #endregion

// #region Manual Refund Processing

/**
 * Get all approved refunds waiting for manual transfer (Staff/Admin)
 */
export const getApprovedRefunds = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [refunds, total] = await Promise.all([
    Refund.find({ status: 'APPROVED' })
      .populate('bookingId', 'finalAmount scheduleId userId')
      .populate('requestedBy', 'fullName username email phone')
      .populate('approvedBy', 'fullName username')
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(limit),
    Refund.countDocuments({ status: 'APPROVED' })
  ]);

  return {
    refunds,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

/**
 * Confirm manual refund transfer completed (Staff/Admin action)
 * Staff calls this after manually transferring money to customer
 * @param {string} refundId - Refund ID to confirm
 * @param {string} staffId - Staff user ID
 * @param {object} opts - Optional transfer details
 * @param {string} opts.transactionRef - Bank transaction reference (optional)
 * @param {string} opts.note - Additional note (optional)
 * @param {string} opts.proofImageUrl - Cloudinary URL of transfer screenshot (optional)
 */
export const confirmManualRefund = async (refundId, staffId, opts = {}) => {
  const { transactionRef, note, proofImageUrl } = opts;
  
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new NotFoundError('Yêu cầu hoàn tiền không tồn tại');
  }

  if (refund.status !== 'APPROVED') {
    throw new ValidationError(`Không thể xác nhận yêu cầu ở trạng thái ${refund.status}. Chỉ có thể xác nhận yêu cầu đã được duyệt.`);
  }

  // Update to COMPLETED
  refund.status = 'COMPLETED';
  refund.processedBy = staffId;
  refund.processedAt = new Date();
  
  // Store transfer details (always set confirmedAt)
  refund.transferDetails = {
    transactionRef: transactionRef || null,
    note: note || null,
    proofImageUrl: proofImageUrl || null,
    confirmedAt: new Date()
  };
  
  await refund.save();

  // Send success notification to customer
  try {
    const booking = await Booking.findById(refund.bookingId);
    if (booking?.userId) {
      await createAndSendNotification(
        booking.userId,
        NOTIFICATION_TYPE.SUCCESS,
        'Hoàn tiền thành công',
        `Tiền hoàn ${refund.amount.toLocaleString()} VND đã được chuyển vào tài khoản ${refund.destinationBank.accountNumber} - ${refund.destinationBank.bankName}.`,
        false,
        null,
        refund._id
      );
    }
  } catch (notifErr) {
    logger.error('Failed to send completion notification:', notifErr);
  }

  logger.info('Manual refund confirmed', { refundId, staffId, transactionRef });

  return refund;
};

// #endregion

// #region Query Functions

/**
 * Get refund by ID with full details
 */
export const getRefundById = async (refundId) => {
  return await Refund.findById(refundId)
    .populate('bookingId')
    .populate('paymentId', 'amount status transactionId')
    .populate('requestedBy', 'fullName username')
    .populate('approvedBy', 'fullName username');
};

/**
 * Get refunds for a booking
 */
export const getRefundsForBooking = async (bookingId) => {
  return await Refund.find({ bookingId })
    .populate('requestedBy', 'fullName username')
    .populate('approvedBy', 'fullName username')
    .sort({ requestedAt: -1 });
};

/**
 * Get refund statistics
 */
export const getRefundStats = async (startDate, endDate) => {
  return await Refund.getStats(startDate, endDate);
};

/**
 * Get all refund requests for a customer (by userId)
 * @param {string} userId - Customer user ID
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} { refunds, total, page, pages }
 */
export const getMyRefunds = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  // Find all bookings for this user
  const userBookings = await Booking.find({ userId }).select('_id');
  const bookingIds = userBookings.map(b => b._id);

  const [refunds, total] = await Promise.all([
    Refund.find({ bookingId: { $in: bookingIds } })
      .populate('bookingId', 'finalAmount scheduleId status')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit),
    Refund.countDocuments({ bookingId: { $in: bookingIds } })
  ]);

  return {
    refunds,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

// #endregion

// #region Notifications

/**
 * Send refund notification to customer
 */
const sendRefundNotification = async (refund, type) => {
  try {
    const booking = await Booking.findById(refund.bookingId);
    if (!booking?.userId) {
      logger.warn('Cannot send refund notification: customer not found');
      return;
    }

    const bookingIdShort = refund.bookingId.toString().slice(-8);
    let message, notificationType;

    if (type === 'completed') {
      message = `Hoàn tiền ${refund.amount.toLocaleString()} VND cho booking #${bookingIdShort} đã được xử lý thành công.`;
      notificationType = NOTIFICATION_TYPE.CONFIRMATION;
    } else {
      message = `Hoàn tiền ${refund.amount.toLocaleString()} VND cho booking #${bookingIdShort} thất bại. Chúng tôi sẽ xử lý lại sớm.`;
      notificationType = NOTIFICATION_TYPE.ERROR;
    }

    await createAndSendNotification(
      booking.userId,
      notificationType,
      type === 'completed' ? 'Hoàn tiền thành công' : 'Hoàn tiền thất bại',
      message,
      false,
      null,
      refund._id
    );
  } catch (error) {
    logger.error('Failed to send refund notification:', error);
  }
};

// #endregion

// #region Legacy Functions

/**
 * @deprecated This function is deprecated and will throw an error.
 * Use POST /api/bookings/:id/refund-request with body: { bankName, accountNumber, accountName }
 */
export const createRefund = async (paymentId, opts = {}) => {
  logger.error('createRefund is deprecated. Use createRefundRequest via POST /api/bookings/:id/refund-request');
  throw new ValidationError(
    'API deprecated. Use POST /api/bookings/:id/refund-request with bankName, accountNumber, accountName'
  );
};

// #endregion
