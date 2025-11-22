//#region Imports
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import crypto from 'crypto';
import Payment from '../models/Payment/payment.model.js';
import Booking from '../models/Booking/booking.model.js';
import payos from '../config/payos.js';
import { PAYMENT_STATUS, PAY_TYPE, BOOKING_STATUS } from '../utils/constants.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
//#endregion

// PayOS description maximum length (PayOS validation)
const PAYOS_DESCRIPTION_MAX = 25;

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len) : str);

/**
 * Generate unique order code for PayOS
 * Uses timestamp for uniqueness (safe for PayOS number constraints)
 */
const generateOrderCode = () => {
  return Date.now();
};

/**
 * Generate unique payment code
 * Format: PAY-{timestamp}-{percentage}-{random}
 */
const generatePaymentCode = (bookingId, percentage) => {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `PAY-${timestamp}-${percentage}-${random}`;
};

/**
 * Format existing payment options for response
 */
const formatPaymentOption = (payment) => {
  const percentageMap = {
    [PAY_TYPE.PREPAY_30]: 30,
    [PAY_TYPE.PREPAY_50]: 50,
    [PAY_TYPE.FULL]: 100
  };

  return {
    percentage: percentageMap[payment.payType] || 100,
    amount: payment.amount,
    description: `${payment.payType} Payment`,
    paymentLink: payment.qrCodeUrl,
    qrCode: payment.gatewayResponse?.qrCode || null,
    paymentId: payment._id,
    orderCode: payment.transactionId
  };
};

/**
 * Create payment options for a booking (30%, 50%, 100%)
 * @param {string} bookingId
 * @returns {Array} Payment options with PayOS links
 */
export const createPaymentOptions = async (bookingId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Lock booking to prevent concurrent payment option creation
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Check if payment options already exist
    const existingPayments = await Payment.find({
      bookingId,
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED] }
    }).session(session);

    if (existingPayments.length > 0) {
      await session.commitTransaction();
      logger.info(`Returning existing payment options for booking ${bookingId}`);
      return existingPayments.map(formatPaymentOption);
    }

    const totalAmount = booking.finalAmount;

    // Validate amount
    if (totalAmount < 1000) {
      throw new ValidationError('Booking amount must be at least 1,000 VND for payment');
    }

    const options = [
      { 
        percentage: 30, 
        amount: Math.round(totalAmount * 0.3), 
        description: 'Deposit', 
        payType: PAY_TYPE.PREPAY_30 
      },
      { 
        percentage: 50, 
        amount: Math.round(totalAmount * 0.5), 
        description: 'Partial Payment', 
        payType: PAY_TYPE.PREPAY_50 
      },
      { 
        percentage: 100, 
        amount: totalAmount, 
        description: 'Full Payment', 
        payType: PAY_TYPE.FULL 
      }
    ];

    const paymentOptions = [];

    for (const option of options) {
      const orderCode = generateOrderCode();
      const paymentCode = generatePaymentCode(bookingId, option.percentage);

      let checkoutUrl = null;
      let qrCodeUrl = null;
      let gatewayResponse = {
        orderCode,
        createdAt: new Date()
      };

      // Real PayOS integration (no mock fallback)
      try {
        const fullDescription = `${option.description} (${option.percentage}%) - Booking #${bookingId.toString().slice(-8)}`;
        const safeDescription = truncate(fullDescription, PAYOS_DESCRIPTION_MAX);
        if (safeDescription !== fullDescription) {
          logger.warn('Truncated PayOS description to fit max length', { fullDescription, safeDescription });
        }

        const paymentData = {
          orderCode,
          amount: option.amount,
          description: safeDescription,
          items: [
            {
              name: truncate(`Studio - ${option.description}`, 50),
              quantity: 1,
              price: option.amount
            }
          ],
          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?bookingId=${bookingId}`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?bookingId=${bookingId}`,
          buyerName: booking.userId?.username || 'Customer',
          buyerEmail: booking.userId?.email || undefined
        };

        logger.info('Creating PayOS payment link', {
          orderCode,
          amount: option.amount,
          description: paymentData.description
        });

        // SDK compatibility: support createPaymentLink or paymentRequests.create
        let paymentLinkResponse;
        if (payos && typeof payos.createPaymentLink === 'function') {
          paymentLinkResponse = await payos.createPaymentLink(paymentData);
        } else if (payos && typeof payos.paymentRequests?.create === 'function') {
          paymentLinkResponse = await payos.paymentRequests.create(paymentData);
        } else {
          throw new Error('PayOS client does not support createPaymentLink or paymentRequests.create');
        }

        // Normalize response (support different SDK shapes)
        checkoutUrl = paymentLinkResponse?.checkoutUrl || paymentLinkResponse?.data?.checkoutUrl || paymentLinkResponse?.data?.url || paymentLinkResponse?.url || null;
        qrCodeUrl = paymentLinkResponse?.qrCode || paymentLinkResponse?.data?.qrCode || null;
        gatewayResponse = {
          ...gatewayResponse,
          paymentLinkId: paymentLinkResponse?.paymentLinkId || paymentLinkResponse?.data?.id || null,
          qrCode: qrCodeUrl,
          bin: paymentLinkResponse?.bin || paymentLinkResponse?.data?.bin || null,
          accountNumber: paymentLinkResponse?.accountNumber || paymentLinkResponse?.data?.accountNumber || null
        };

        logger.info('PayOS response received', {
          orderCode,
          hasCheckoutUrl: !!checkoutUrl
        });

        if (!checkoutUrl) {
          throw new Error('PayOS did not return a valid checkout URL');
        }

      } catch (payosError) {
        logger.error('PayOS API Error:', {
          message: payosError.message,
          code: payosError.code,
          orderCode
        });

        throw new Error(`Payment gateway error: ${payosError.message || 'Failed to create payment link'}`);
      }

      // Save payment record to database within transaction
      const payment = await Payment.create([{
        bookingId,
        paymentCode,
        amount: option.amount,
        payType: option.payType,
        status: PAYMENT_STATUS.PENDING,
        transactionId: orderCode.toString(),
        qrCodeUrl: checkoutUrl,
        gatewayResponse
      }], { session });

      logger.info('Payment record created', {
        paymentId: payment[0]._id,
        orderCode,
        amount: option.amount
      });

      paymentOptions.push({
        percentage: option.percentage,
        amount: option.amount,
        description: option.description,
        paymentLink: checkoutUrl,
        qrCode: qrCodeUrl,
        paymentId: payment[0]._id,
        orderCode
      });
    }

    await session.commitTransaction();
    return paymentOptions;

  } catch (error) {
    await session.abortTransaction();
    logger.error('Create payment options failed:', {
      bookingId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Handle PayOS webhook/callback
 * @param {Object} webhookBody - Webhook data from PayOS
 * @returns {Object} Processing result
 */
export const handlePaymentWebhook = async (webhookPayload) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Accept either raw body or an object { body, headers }
    const incoming = webhookPayload && webhookPayload.body ? webhookPayload : { body: webhookPayload, headers: {} };
    const body = incoming.body || {};
    const headers = incoming.headers || {};

    logger.info('Processing PayOS webhook', { body, headers: Object.keys(headers) });

    // Verify webhook signature using PayOS SDK if available, otherwise fallback
    let verifiedData;
    try {
      if (payos && typeof payos.verifyPaymentWebhookData === 'function') {
        verifiedData = payos.verifyPaymentWebhookData(body);
      } else {
        // Fallback simple verification using checksum key (HMAC-SHA256)
        const headerSig = headers['x-payos-signature'] || headers['x-payos-signature'] || headers['x-payos-sign'] || null;
        const signature = headerSig || body.signature || body.sign || body.data?.signature;
        const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
        if (!checksumKey) {
          throw new ValidationError('Missing PAYOS_CHECKSUM_KEY for webhook verification');
        }
        const dataToSign = `${body.code || ''}${body.desc || ''}`;
        const computedSignature = crypto.createHmac('sha256', checksumKey).update(dataToSign).digest('hex');
        logger.info('Webhook signature debug', { providedSignature: signature, computedSignature });
        if (!signature || computedSignature.toLowerCase() !== signature.toString().toLowerCase()) {
          throw new ValidationError('Invalid webhook signature');
        }
        // Use data field as verified payload
        verifiedData = body.data || {
          orderCode: body.orderCode,
          amount: body.amount,
          code: body.code,
          desc: body.desc
        };
      }
    } catch (verifyError) {
      logger.error('Webhook verification failed:', verifyError);
      throw new ValidationError('Invalid webhook signature: ' + (verifyError.message || 'verification failed'));
    }

    const orderCode = verifiedData.orderCode;
    const amount = verifiedData.amount;
    const code = verifiedData.code; // "00" = success
    const desc = verifiedData.desc;

    logger.info('Webhook verified', { orderCode, code, desc });

    // Find payment by transaction ID (orderCode)
    const payment = await Payment.findOne({ 
      transactionId: orderCode.toString() 
    }).session(session);

    if (!payment) {
      await session.commitTransaction();
      logger.warn(`Payment not found for orderCode: ${orderCode}`);
      return { success: false, message: 'Payment not found' };
    }

    // Check if already processed to prevent duplicate processing
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      await session.commitTransaction();
      logger.info(`Payment already processed: ${payment._id}`);
      return { success: true, message: 'Payment already processed' };
    }

    // Update payment based on status
    const isPaid = code === '00'; // PayOS success code

    if (isPaid) {
      payment.status = PAYMENT_STATUS.COMPLETED;
      payment.paidAt = new Date();
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        webhookData: verifiedData,
        completedAt: new Date()
      };
      await payment.save({ session });

      logger.info(`Payment completed: ${payment._id}`);

      // Update booking status
      const booking = await Booking.findById(payment.bookingId).session(session);
      
      if (booking) {
        // Calculate total paid amount using aggregation for accuracy
        const paidSummary = await Payment.aggregate([
          {
            $match: {
              bookingId: booking._id,
              status: PAYMENT_STATUS.COMPLETED
            }
          },
          {
            $group: {
              _id: null,
              totalPaid: { $sum: '$amount' }
            }
          }
        ]).session(session);

        const totalPaid = paidSummary[0]?.totalPaid || 0;
        const paymentPercentage = (totalPaid / booking.finalAmount) * 100;

        logger.info(`Booking ${booking._id} payment progress: ${paymentPercentage.toFixed(2)}%`, {
          totalPaid,
          finalAmount: booking.finalAmount
        });

        // Update booking status and payType based on payment progress
        if (paymentPercentage >= 100) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.payType = PAY_TYPE.FULL;
        } else if (paymentPercentage >= 50) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.payType = PAY_TYPE.PREPAY_50;
        } else if (paymentPercentage >= 30) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.payType = PAY_TYPE.PREPAY_30;
        }

        await booking.save({ session });
        logger.info(`Booking ${booking._id} updated to ${booking.status}`);
      }

      await session.commitTransaction();
      return { success: true, message: 'Payment processed successfully' };

    } else {
      // Payment failed or cancelled
      payment.status = PAYMENT_STATUS.CANCELLED;
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        webhookData: verifiedData,
        cancelledAt: new Date(),
        failureReason: desc
      };
      await payment.save({ session });

      await session.commitTransaction();
      logger.info(`Payment cancelled/failed: ${payment._id}, reason: ${desc}`);
      return { success: true, message: 'Payment cancelled' };
    }

  } catch (error) {
    await session.abortTransaction();
    logger.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get payment status
 * @param {string} paymentId
 */
export const getPaymentStatus = async (paymentId) => {
  const payment = await Payment.findById(paymentId)
    .populate('bookingId')
    .lean();

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  return payment;
};

/**
 * Check payment status with PayOS
 * @param {string} orderCode
 */
export const checkPaymentStatusWithPayOS = async (orderCode) => {
  try {
    if (payos && typeof payos.getPaymentLinkInformation === 'function') {
      const paymentInfo = await payos.getPaymentLinkInformation(Number(orderCode));

      logger.info('PayOS payment info retrieved', {
        orderCode,
        status: paymentInfo?.status
      });

      return paymentInfo;
    } else if (payos && typeof payos.paymentRequests?.get === 'function') {
      const paymentInfo = await payos.paymentRequests.get(Number(orderCode));
      return paymentInfo;
    }

    throw new Error('PayOS client does not support getPaymentLinkInformation');
  } catch (error) {
    logger.error('Failed to check PayOS payment status:', {
      orderCode,
      error: error.message
    });
    throw error;
  }
};

/**
 * Cancel payment
 * @param {string} paymentId
 * @param {string} reason
 */
export const cancelPayment = async (paymentId, reason = 'User cancelled') => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    throw new ValidationError('Can only cancel pending payments');
  }

  // Cancel with PayOS if not mock
  const useMock = (process.env.PAYMENT_USE_MOCK || 'false').toLowerCase() === 'true';

  if (!useMock) {
    try {
      if (payos && typeof payos.cancelPaymentLink === 'function') {
        await payos.cancelPaymentLink(Number(payment.transactionId), reason);
      } else if (payos && typeof payos.paymentRequests?.cancel === 'function') {
        await payos.paymentRequests.cancel(Number(payment.transactionId), reason);
      } else {
        logger.warn('PayOS client does not support cancel API');
      }

      logger.info('Payment cancelled with PayOS', {
        paymentId,
        orderCode: payment.transactionId
      });
    } catch (error) {
      logger.error('Failed to cancel with PayOS:', error);
      // Continue with local cancellation even if PayOS fails
    }
  }

  payment.status = PAYMENT_STATUS.CANCELLED;
  payment.refundReason = reason;
  payment.gatewayResponse = {
    ...payment.gatewayResponse,
    cancelledAt: new Date(),
    cancelReason: reason
  };
  await payment.save();

  return payment;
};

/**
 * Create a single payment for a chosen option (idempotent per booking+payType)
 * opts: { percentage, payType }
 */
export const createPaymentForOption = async (bookingId, opts = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const totalAmount = booking.finalAmount;
    if (totalAmount < 1000) {
      throw new ValidationError('Booking amount must be at least 1,000 VND for payment');
    }

    // Determine payType and amount
    const perc = opts.percentage ? Number(opts.percentage) : null;
    const payTypeMap = {
      30: PAY_TYPE.PREPAY_30,
      50: PAY_TYPE.PREPAY_50,
      100: PAY_TYPE.FULL
    };
    const payType = opts.payType || payTypeMap[perc];
    if (!payType) {
      throw new ValidationError('Invalid percentage or payType');
    }

    const amount = payType === PAY_TYPE.FULL ? totalAmount : Math.round(totalAmount * (payType === PAY_TYPE.PREPAY_30 ? 0.3 : 0.5));

    // Idempotency: return existing pending payment for same booking+payType
    const existing = await Payment.findOne({ bookingId, payType, status: PAYMENT_STATUS.PENDING }).session(session);
    if (existing) {
      await session.commitTransaction();
      return existing;
    }

    const orderCode = generateOrderCode();
    const paymentCode = generatePaymentCode(bookingId, perc || (payType === PAY_TYPE.FULL ? 100 : (payType === PAY_TYPE.PREPAY_50 ? 50 : 30)));

    // Build paymentData (reuse same normalization rules)
    const fullDescription = `${payType} - Booking #${bookingId.toString().slice(-8)}`;
    const safeDescription = truncate(fullDescription, PAYOS_DESCRIPTION_MAX);

    const paymentData = {
      orderCode,
      amount,
      description: safeDescription,
      items: [{ name: truncate(`Studio - ${payType}`, 50), quantity: 1, price: amount }],
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?bookingId=${bookingId}`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?bookingId=${bookingId}`,
      buyerName: booking.userId?.username || 'Customer',
      buyerEmail: booking.userId?.email || undefined
    };

    logger.info('Creating single PayOS payment link', { orderCode, amount, description: paymentData.description });

    let paymentLinkResponse;
    if (payos && typeof payos.createPaymentLink === 'function') {
      paymentLinkResponse = await payos.createPaymentLink(paymentData);
    } else if (payos && typeof payos.paymentRequests?.create === 'function') {
      paymentLinkResponse = await payos.paymentRequests.create(paymentData);
    } else {
      throw new Error('PayOS client does not support createPaymentLink or paymentRequests.create');
    }

    const checkoutUrl = paymentLinkResponse?.checkoutUrl || paymentLinkResponse?.data?.checkoutUrl || paymentLinkResponse?.data?.url || paymentLinkResponse?.url || null;
    const qrCodeUrl = paymentLinkResponse?.qrCode || paymentLinkResponse?.data?.qrCode || null;
    const gatewayResponse = { orderCode, createdAt: new Date(), paymentLinkId: paymentLinkResponse?.paymentLinkId || paymentLinkResponse?.data?.id || null, qrCode: qrCodeUrl };

    if (!checkoutUrl) {
      throw new Error('PayOS did not return a valid checkout URL');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const payment = await Payment.create([{ bookingId, paymentCode, amount, payType, status: PAYMENT_STATUS.PENDING, transactionId: orderCode.toString(), qrCodeUrl: checkoutUrl, gatewayResponse, expiresAt }], { session });

    await session.commitTransaction();
    return payment[0];

  } catch (error) {
    await session.abortTransaction();
    logger.error('Create single payment failed:', { bookingId, error: error.message });
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Create payment for the remaining amount after existing completed payments
 */
export const createPaymentForRemaining = async (bookingId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Sum completed payments
    const paidSummary = await Payment.aggregate([
      { $match: { bookingId: booking._id, status: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]).session(session);

    const totalPaid = paidSummary[0]?.totalPaid || 0;
    const remaining = booking.finalAmount - totalPaid;

    if (remaining <= 0) {
      await session.commitTransaction();
      throw new ValidationError('No remaining amount to pay');
    }

    // Idempotency: check existing pending 'full' payment created as remaining
    const existing = await Payment.findOne({ bookingId, payType: PAY_TYPE.FULL, status: PAYMENT_STATUS.PENDING }).session(session);
    if (existing) {
      await session.commitTransaction();
      return existing;
    }

    const orderCode = generateOrderCode();
    const paymentCode = generatePaymentCode(bookingId, 100);

    const fullDescription = `Remaining - Booking #${bookingId.toString().slice(-8)}`;
    const safeDescription = truncate(fullDescription, PAYOS_DESCRIPTION_MAX);

    const paymentData = {
      orderCode,
      amount: remaining,
      description: safeDescription,
      items: [{ name: truncate(`Studio - remaining`, 50), quantity: 1, price: remaining }],
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?bookingId=${bookingId}`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?bookingId=${bookingId}`,
      buyerName: booking.userId?.username || 'Customer',
      buyerEmail: booking.userId?.email || undefined
    };

    logger.info('Creating PayOS payment link for remaining amount', { orderCode, amount: remaining });

    let paymentLinkResponse;
    if (payos && typeof payos.createPaymentLink === 'function') {
      paymentLinkResponse = await payos.createPaymentLink(paymentData);
    } else if (payos && typeof payos.paymentRequests?.create === 'function') {
      paymentLinkResponse = await payos.paymentRequests.create(paymentData);
    } else {
      throw new Error('PayOS client does not support createPaymentLink or paymentRequests.create');
    }

    const checkoutUrl = paymentLinkResponse?.checkoutUrl || paymentLinkResponse?.data?.checkoutUrl || paymentLinkResponse?.data?.url || paymentLinkResponse?.url || null;
    const qrCodeUrl = paymentLinkResponse?.qrCode || paymentLinkResponse?.data?.qrCode || null;
    const gatewayResponse = { orderCode, createdAt: new Date(), paymentLinkId: paymentLinkResponse?.paymentLinkId || paymentLinkResponse?.data?.id || null, qrCode: qrCodeUrl };

    if (!checkoutUrl) {
      throw new Error('PayOS did not return a valid checkout URL');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const payment = await Payment.create([{ bookingId, paymentCode, amount: remaining, payType: PAY_TYPE.FULL, status: PAYMENT_STATUS.PENDING, transactionId: orderCode.toString(), qrCodeUrl: checkoutUrl, gatewayResponse, expiresAt }], { session });

    await session.commitTransaction();
    return payment[0];
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create remaining payment failed:', { bookingId, error: error.message });
    throw error;
  } finally {
    session.endSession();
  }
};