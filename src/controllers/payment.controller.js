//#region Imports
import { createPaymentOptions, handlePaymentWebhook, getPaymentStatus, createPaymentForRemaining } from '../services/payment.service.js';
import { createPaymentForOption } from '../services/payment.service.js';
import { ValidationError } from '../utils/errors.js';
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

    const payment = await createPaymentForRemaining(bookingId);

    res.status(200).json({ success: true, message: 'Remaining payment created', data: payment });
  } catch (error) {
    logger.error('Create remaining payment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};