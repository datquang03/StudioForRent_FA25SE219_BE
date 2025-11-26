//#region Imports
import { createPaymentOptions, handlePaymentWebhook, getPaymentStatus, createPaymentForRemaining } from '../services/payment.service.js';
import { createPaymentForOption } from '../services/payment.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import Booking from '../models/Booking/booking.model.js';
import Payment from '../models/Payment/payment.model.js';
import { USER_ROLES } from '../utils/constants.js';
import logger from '../utils/logger.js';
//#endregion

/**
 * Create payment options for booking
 * POST /api/payments/options/:bookingId
 */
export const createPaymentOptionsController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    const paymentOptions = await createPaymentOptions(bookingId);

    res.status(200).json({
      success: true,
      message: 'Payment options created successfully',
      data: paymentOptions
    });
  } catch (error) {
    logger.error('Create payment options error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * PayOS webhook handler
 * POST /api/payments/webhook
 */
export const paymentWebhookController = async (req, res) => {
  try {
    // Pass both body and headers to the service so it can verify header signatures too
    const webhookPayload = { body: req.body, headers: req.headers };
    await handlePaymentWebhook(webhookPayload);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Payment webhook error:', error);
    // In development return the error message for easier debugging
    const msg = (process.env.NODE_ENV || 'development') === 'production' ? 'Webhook processing failed' : (error.message || 'Webhook processing failed');
    res.status(500).json({ success: false, message: msg });
  }
};

/**
 * Get payment status
 * GET /api/payments/:paymentId
 */
export const getPaymentStatusController = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await getPaymentStatus(paymentId);

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Get payment status error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Create a single payment for selected option
 * POST /api/payments/create/:bookingId
 */
export const createSinglePaymentController = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { percentage, payType } = req.body;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Either percentage or payType must be provided
    if (!percentage && !payType) {
      throw new ValidationError('percentage or payType is required');
    }

    const payment = await createPaymentForOption(bookingId, { percentage, payType });

    res.status(200).json({ success: true, message: 'Payment created', data: payment });
  } catch (error) {
    logger.error('Create single payment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

/**
 * Create payment for remaining amount after deposit
 * POST /api/payments/remaining/:bookingId
 */
export const createRemainingPaymentController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Ensure booking exists and enforce ownership for customers
    const booking = await Booking.findById(bookingId).select('userId');
    if (!booking) throw new NotFoundError('Booking not found');

    if (req.user && req.user.role === USER_ROLES.CUSTOMER) {
      if (!booking.userId || booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden: not owner of booking' });
      }
    }

    // Pass actorId for audit (who created the remaining payment)
    const payment = await createPaymentForRemaining(bookingId, { actorId: req.user?._id });

    res.status(200).json({ success: true, message: 'Remaining payment created', data: payment });
  } catch (error) {
    logger.error('Create remaining payment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

/**
 * Get payment history for customer
 * GET /api/payments/history
 */
export const getCustomerPaymentHistoryController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // Build query to get payments through user's bookings
    let bookingQuery = { userId };
    if (startDate || endDate) {
      bookingQuery.createdAt = {};
      if (startDate) bookingQuery.createdAt.$gte = new Date(startDate);
      if (endDate) bookingQuery.createdAt.$lte = new Date(endDate);
    }

    const userBookings = await Booking.find(bookingQuery).select('_id');
    const bookingIds = userBookings.map(b => b._id);

    let paymentQuery = { bookingId: { $in: bookingIds } };
    if (status) paymentQuery.status = status;

    const payments = await Payment.find(paymentQuery)
      .populate({
        path: 'bookingId',
        select: 'status totalBeforeDiscount finalAmount createdAt',
        populate: {
          path: 'scheduleId',
          select: 'startTime endTime',
          populate: {
            path: 'studioId',
            select: 'name location'
          }
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(paymentQuery);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get customer payment history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get payment history for staff/admin
 * GET /api/payments/staff/history
 */
export const getStaffPaymentHistoryController = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, studioId } = req.query;

    let query = {};
    if (status) query.status = status;
    if (studioId) {
      // Filter by studio through booking -> schedule
      const bookings = await Booking.find({
        'scheduleId.studioId': studioId
      }).select('_id');
      query.bookingId = { $in: bookings.map(b => b._id) };
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate({
        path: 'bookingId',
        select: 'status totalBeforeDiscount finalAmount userId createdAt',
        populate: [
          {
            path: 'userId',
            select: 'fullName email phone'
          },
          {
            path: 'scheduleId',
            select: 'startTime endTime',
            populate: {
              path: 'studioId',
              select: 'name location'
            }
          }
        ]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get staff payment history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Create refund request
 * POST /api/payments/:paymentId/refund
 */
export const createRefundController = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const actorId = req.user._id;

    if (!paymentId) {
      throw new ValidationError('Payment ID is required');
    }

    // Import refund service function (will create)
    const { createRefund } = await import('../services/payment.service.js');
    const refund = await createRefund(paymentId, { amount, reason, actorId });

    res.status(201).json({
      success: true,
      message: 'Refund request created successfully',
      data: refund
    });
  } catch (error) {
    logger.error('Create refund error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get refund status
 * GET /api/payments/:paymentId/refund
 */
export const getRefundStatusController = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Import Refund service
    const { getRefundsForPayment } = await import('../services/refund.service.js');
    const refunds = await getRefundsForPayment(paymentId);

    res.status(200).json({
      success: true,
      data: refunds // Return all refunds as an array (empty if none)
    });
  } catch (error) {
    logger.error('Get refund status error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};