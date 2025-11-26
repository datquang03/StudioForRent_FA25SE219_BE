import mongoose from 'mongoose';
import Refund from '../models/Refund/refund.model.js';
import Payment from '../models/Payment/payment.model.js';
import payos from '../config/payos.js';
import { PAYMENT_STATUS } from '../utils/constants.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';

/**
 * Create refund request for a payment
 * @param {string} paymentId - Payment ID to refund
 * @param {object} opts - Options object
 * @param {number} opts.amount - Refund amount (optional, defaults to full payment amount)
 * @param {string} opts.reason - Reason for refund
 * @param {string} opts.actorId - ID of user initiating refund (staff/admin)
 * @returns {object} Refund information
 */
export const createRefund = async (paymentId, opts = {}) => {
  const { amount, reason, actorId } = opts;

  // 0. Basic validation will be performed here to allow early exits without opening a session
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }
  if (payment.status !== PAYMENT_STATUS.PAID) {
    throw new ValidationError('Only paid payments can be refunded');
  }

  // Check for existing active refunds (fast path)
  const existingRefund = await Refund.findOne({ paymentId, status: { $in: ['PENDING', 'PROCESSING'] } });
  if (existingRefund) {
    throw new ValidationError('Refund already exists for this payment');
  }

  // 1. Start transaction to create refund atomically
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Recalculate amounts within transaction for accuracy
    const paymentForTx = await Payment.findById(paymentId).session(session);
    if (!paymentForTx) {
      throw new NotFoundError('Payment not found');
    }

    const refundAmount = amount || paymentForTx.amount;

    const completedRefunds = await Refund.find({ paymentId, status: 'COMPLETED' }).session(session);
    const totalRefunded = completedRefunds.reduce((sum, r) => sum + r.amount, 0);
    const remainingAmount = paymentForTx.amount - totalRefunded;

    if (refundAmount > remainingAmount) {
      throw new ValidationError(`Refund amount (${refundAmount}) exceeds remaining amount (${remainingAmount})`);
    }

    // Create refund record; handle duplicate-key race
    let refund;
    try {
      refund = await Refund.create([
        {
          paymentId,
          amount: refundAmount,
          reason: reason || 'Customer requested refund',
          requestedBy: actorId,
          status: 'PENDING'
        }
      ], { session });
    } catch (err) {
      // Duplicate key (race) - surface friendly error
      if (err && err.code === 11000) {
        throw new ValidationError('Refund already exists for this payment');
      }
      throw err;
    }

    // Commit transaction - do NOT change payment.status here. Update the payment only when refund completes.
    await session.commitTransaction();

    // Start async processing (won't affect DB transaction state)
    processPayOSRefund(refund[0]._id).catch(error => {
      logger.error('Failed to start PayOS refund processing:', error);
    });
    return refund[0];
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create refund failed:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Process refund with PayOS
 * @param {string} refundId - Refund ID to process
 */
export const processPayOSRefund = async (refundId) => {
  // First, fetch refund without a session to perform quick existence/status check
  const refundCheck = await Refund.findById(refundId).populate('paymentId');
  if (!refundCheck) {
    throw new NotFoundError('Refund not found');
  }
  if (refundCheck.status !== 'PENDING') {
    logger.info(`Refund ${refundId} already processed with status: ${refundCheck.status}`);
    return;
  }

  // Start a transaction to mark refund PROCESSING atomically
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const refund = await Refund.findById(refundId).populate('paymentId').session(session);
    if (!refund) {
      throw new NotFoundError('Refund not found');
    }
    if (refund.status !== 'PENDING') {
      await session.commitTransaction();
      logger.info(`Refund ${refundId} already processed with status: ${refund.status}`);
      return;
    }
    refund.status = 'PROCESSING';
    await refund.save({ session });
    await session.commitTransaction();

    // 3. Call PayOS refund API (outside transaction for better performance)
    try {
      let payosResult = null;

      if (payos && typeof payos.refundPayment === 'function') {
        // PayOS refund API call
        payosResult = await payos.refundPayment({
          paymentId: refund.paymentId.transactionId, // PayOS order code
          amount: refund.amount,
          reason: refund.reason
        });

        logger.info('PayOS refund API called successfully', {
          refundId,
          payosRefundId: payosResult?.refundId,
          amount: refund.amount
        });

      } else {
        // Mock refund for development
        logger.warn('PayOS refund API not available, using mock response');
        payosResult = {
          refundId: `mock_refund_${Date.now()}`,
          status: 'completed',
          amount: refund.amount,
          processedAt: new Date()
        };
      }

      // 4. Update refund as COMPLETED
      await updateRefundStatusAndPayment(refundId, 'COMPLETED', {
        payosRefundId: payosResult.refundId,
        payosResponse: payosResult,
        processedBy: null, // System processed
        processedAt: new Date()
      });

      // 5. Send success notification
      await sendRefundNotification(refund, 'completed');

    } catch (payosError) {
      logger.error('PayOS refund failed:', {
        refundId,
        error: payosError.message,
        code: payosError.code
      });

      // Update refund as FAILED
      await updateRefundStatusAndPayment(refundId, 'FAILED', {
        failureReason: payosError.message || 'PayOS refund failed',
        processedBy: null,
        processedAt: new Date()
      });

      // Send failure notification
      await sendRefundNotification(refund, 'failed');
    }

  } catch (error) {
    logger.error('Process PayOS refund failed outer:', error);
    throw error;
  } finally {
    try { session.endSession(); } catch (e) { /* ignore */ }
  }
};

/**
 * Update refund status
 * @param {string} refundId - Refund ID
 * @param {string} status - New status
 * @param {object} updateData - Additional update data
 */
export const updateRefundStatus = async (refundId, status, updateData = {}) => {
  const update = {
    status,
    ...updateData
  };

  if (status === 'COMPLETED' || status === 'FAILED') {
    update.processedAt = update.processedAt || new Date();
  }

  await Refund.findByIdAndUpdate(refundId, update);

  logger.info(`Refund ${refundId} status updated to ${status}`);
};

// Ensure payment status is updated after updating refund status
// Wrap original updateRefundStatus to trigger payment update when appropriate
const originalUpdateRefundStatus = updateRefundStatus;
export const updateRefundStatusAndPayment = async (refundId, status, updateData = {}) => {
  await originalUpdateRefundStatus(refundId, status, updateData);
  // If refund completed, try updating payment
  if (status === 'COMPLETED') {
    await updatePaymentAfterRefund(refundId);
  }
};

// When a refund completes, update the related payment status accordingly
const updatePaymentAfterRefund = async (refundId) => {
  try {
    const refund = await Refund.findById(refundId);
    if (!refund) return;
    if (refund.status !== 'COMPLETED') return;

    // Mark payment as refunded if fully refunded
    const payment = await Payment.findById(refund.paymentId);
    if (!payment) return;

    // Calculate total refunded amount for payment
    const completedRefunds = await Refund.find({ paymentId: payment._id, status: 'COMPLETED' });
    const totalRefunded = completedRefunds.reduce((s, r) => s + r.amount, 0);

    if (totalRefunded >= payment.amount) {
      payment.status = PAYMENT_STATUS.REFUNDED;
      await payment.save();
      logger.info(`Payment ${payment._id} marked as REFUNDED after refund ${refundId}`);
    }
  } catch (err) {
    logger.error('Failed to update payment after refund:', err);
  }
};

/**
 * Get refund by ID with full details
 * @param {string} refundId - Refund ID
 */
export const getRefundById = async (refundId) => {
  return await Refund.findById(refundId)
    .populate('paymentId', 'amount status transactionId')
    .populate('requestedBy', 'fullName username')
    .populate('processedBy', 'fullName username');
};

/**
 * Get refunds for a payment
 * @param {string} paymentId - Payment ID
 */
export const getRefundsForPayment = async (paymentId) => {
  return await Refund.find({ paymentId })
    .populate('requestedBy', 'fullName username')
    .sort({ requestedAt: -1 });
};

/**
 * Get refund statistics
 * @param {Date} startDate - Start date filter
 * @param {Date} endDate - End date filter
 */
export const getRefundStats = async (startDate, endDate) => {
  return await Refund.getStats(startDate, endDate);
};

/**
 * Retry failed refund
 * @param {string} refundId - Refund ID to retry
 * @param {string} actorId - User initiating retry
 */
export const retryRefund = async (refundId, actorId) => {
  const refund = await Refund.findById(refundId);

  if (!refund) {
    throw new NotFoundError('Refund not found');
  }

  if (!refund.canRetry()) {
    throw new ValidationError('Refund cannot be retried at this time');
  }

  // Reset status and retry
  refund.status = 'PENDING';
  refund.failureReason = null;
  await refund.save();

  // Start processing again
  await processPayOSRefund(refundId);

  return refund;
};

/**
 * Send refund notification to customer
 * @param {object} refund - Refund object
 * @param {string} type - 'completed' or 'failed'
 */
const sendRefundNotification = async (refund, type) => {
  try {
    // Get customer from booking
    const payment = await Payment.findById(refund.paymentId).populate('bookingId');
    if (!payment?.bookingId?.userId) {
      logger.warn('Cannot send refund notification: customer not found', { refundId: refund._id });
      return;
    }

    const customerId = payment.bookingId.userId;
    const bookingId = payment.bookingId._id.toString().slice(-8);

    let message, notificationType;

    if (type === 'completed') {
      message = `Hoàn tiền ${refund.amount.toLocaleString()} VND cho booking #${bookingId} đã được xử lý thành công. Lý do: ${refund.reason}`;
      notificationType = NOTIFICATION_TYPE.CONFIRMATION;
    } else {
      message = `Hoàn tiền ${refund.amount.toLocaleString()} VND cho booking #${bookingId} thất bại. Chúng tôi sẽ xử lý lại trong thời gian sớm nhất.`;
      notificationType = NOTIFICATION_TYPE.ERROR;
    }

    await createAndSendNotification(
      customerId,
      notificationType,
      type === 'completed' ? 'Hoàn tiền thành công' : 'Hoàn tiền thất bại',
      message,
      false, // Don't send email for now
      null,
      refund._id
    );

  } catch (error) {
    logger.error('Failed to send refund notification:', error);
  }
};