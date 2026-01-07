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

/**
 * Call PayOS Payout API to transfer money to customer bank account
 */
const callPayOSPayoutAPI = async ({ amount, bankCode, accountNumber, description, referenceId }) => {
  const PAYOS_API_BASE = 'https://api.payos.vn/v2';
  
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': process.env.PAYOS_CLIENT_ID,
    'x-api-key': process.env.PAYOS_API_KEY
  };

  const body = {
    referenceId: referenceId,
    amount: amount,
    description: description.substring(0, 25),
    toBin: bankCode,
    toAccountNumber: accountNumber,
    category: ['refund']
  };

  logger.info('Calling PayOS Payout API', { referenceId, amount, bankCode });

  const response = await fetch(`${PAYOS_API_BASE}/payouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const result = await response.json();

  if (result.code !== '00' || !response.ok) {
    logger.error('PayOS Payout API failed', { result });
    throw new Error(result.desc || result.message || 'PayOS Payout failed');
  }

  logger.info('PayOS Payout API success', { 
    payoutId: result.data?.id,
    state: result.data?.approvalState 
  });

  return result.data;
};

// #endregion

// #region Customer Functions

/**
 * Create refund request for a booking (Customer action)
 * @param {string} bookingId - Booking ID to refund
 * @param {object} opts - Options object
 * @param {string} opts.bankCode - Bank BIN code - REQUIRED
 * @param {string} opts.accountNumber - Customer bank account number - REQUIRED
 * @param {string} opts.userId - ID of customer creating request
 * @returns {object} Refund information
 */
export const createRefundRequest = async (bookingId, opts = {}) => {
  const { bankCode, accountNumber, userId } = opts;

  // Validate bank info
  if (!bankCode || !accountNumber) {
    throw new ValidationError('Thông tin ngân hàng (bankCode và accountNumber) là bắt buộc');
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
    status: { $in: ['PENDING_APPROVAL', 'PENDING', 'PROCESSING'] } 
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
    const refund = await Refund.create([{
      bookingId,
      amount: refundAmount,
      reason: `Hoàn tiền booking - ${refundPercentage}% theo chính sách`,
      requestedBy: userId,
      status: 'PENDING_APPROVAL',
      destinationBank: {
        bin: bankCode,
        accountNumber: accountNumber
      },
      payoutState: 'PENDING'
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
  if (!refund.destinationBank?.bin || !refund.destinationBank?.accountNumber) {
    throw new ValidationError('Thiếu thông tin ngân hàng');
  }

  // Update status and start processing
  refund.status = 'PENDING';
  refund.approvedBy = staffId;
  refund.approvedAt = new Date();
  await refund.save();

  // Start async payout processing
  processPayOSRefund(refundId).catch(error => {
    logger.error('Failed to process PayOS refund:', error);
  });

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

// #region Payout Processing

/**
 * Process refund with PayOS Payout API
 */
export const processPayOSRefund = async (refundId) => {
  const refundCheck = await Refund.findById(refundId).populate('bookingId');
  if (!refundCheck) {
    throw new NotFoundError('Refund not found');
  }
  if (refundCheck.status !== 'PENDING') {
    logger.info(`Refund ${refundId} not in PENDING status: ${refundCheck.status}`);
    return;
  }

  // Validate bank info
  if (!refundCheck.destinationBank?.bin || !refundCheck.destinationBank?.accountNumber) {
    await Refund.findByIdAndUpdate(refundId, {
      status: 'FAILED',
      payoutState: 'FAILED',
      failureReason: 'Thiếu thông tin ngân hàng',
      processedAt: new Date()
    });
    throw new ValidationError('Refund missing bank info');
  }

  // Mark as PROCESSING
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const refund = await Refund.findById(refundId).session(session);
    if (!refund || refund.status !== 'PENDING') {
      await session.commitTransaction();
      return;
    }

    const payoutReferenceId = `refund_${refundId}_${Date.now()}`;
    refund.status = 'PROCESSING';
    refund.payoutState = 'PROCESSING';
    refund.payoutReferenceId = payoutReferenceId;
    await refund.save({ session });
    await session.commitTransaction();

    // Call PayOS Payout API
    try {
      const payoutResult = await callPayOSPayoutAPI({
        amount: refund.amount,
        bankCode: refund.destinationBank.bin,
        accountNumber: refund.destinationBank.accountNumber,
        description: 'Hoan tien booking',
        referenceId: payoutReferenceId
      });

      await Refund.findByIdAndUpdate(refundId, {
        status: 'COMPLETED',
        payoutId: payoutResult.id,
        payoutState: 'SUCCESS',
        payoutResponse: payoutResult,
        'destinationBank.accountName': payoutResult.transactions?.[0]?.toAccountName || null,
        processedAt: new Date()
      });

      // Send success notification
      await sendRefundNotification(refund, 'completed');

    } catch (payoutError) {
      logger.error('PayOS Payout failed:', { refundId, error: payoutError.message });

      await Refund.findByIdAndUpdate(refundId, {
        status: 'FAILED',
        payoutState: 'FAILED',
        failureReason: payoutError.message || 'PayOS Payout failed',
        processedAt: new Date()
      });

      await sendRefundNotification(refund, 'failed');
    }

  } catch (error) {
    await session.abortTransaction();
    logger.error('Process refund failed:', error);
    throw error;
  } finally {
    session.endSession();
  }
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
 * Retry failed refund
 */
export const retryRefund = async (refundId, actorId) => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new NotFoundError('Refund not found');
  }
  if (!refund.canRetry()) {
    throw new ValidationError('Refund cannot be retried at this time');
  }

  refund.status = 'PENDING';
  refund.payoutState = 'PENDING';
  refund.failureReason = null;
  await refund.save();

  await processPayOSRefund(refundId);

  return refund;
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
 * @deprecated Use createRefundRequest instead
 */
export const createRefund = async (paymentId, opts = {}) => {
  logger.warn('createRefund is deprecated, use createRefundRequest instead');
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment not found');
  return createRefundRequest(payment.bookingId, opts);
};

// #endregion
