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
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import { claimIdempotencyKey } from '../utils/redisHelpers.js';
//#endregion

// PayOS description maximum length (PayOS validation)
const PAYOS_DESCRIPTION_MAX = 25;

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len) : str);

/**
 * Generate unique order code for PayOS
 * Uses timestamp + random 3 digits for uniqueness (safe for PayOS number constraints)
 */
const generateOrderCode = () => {
  // Date.now() is ~13 digits. Max safe integer is 16 digits.
  // We can append 3 digits safely.
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return Number(`${timestamp}${random.toString().padStart(3, '0')}`);
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
    // Validate bookingId
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ValidationError('ID booking không hợp lệ');
    }

    // Lock booking to prevent concurrent payment option creation
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking không tồn tại');
    }

    // Validate booking status
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ValidationError('Không thể tạo thanh toán cho booking đã hủy');
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ValidationError('Booking đã hoàn thành, không thể tạo thanh toán mới');
    }

    // Check if payment options already exist
    const existingPayments = await Payment.find({
      bookingId,
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID] }
    }).session(session);

    // Check if already has paid payment
    const paidPayment = existingPayments.find(p => p.status === PAYMENT_STATUS.PAID);
    if (paidPayment) {
      throw new ValidationError('Booking đã có thanh toán thành công, không thể tạo mới');
    }

    if (existingPayments.length > 0) {
      await session.commitTransaction();
      logger.info(`Returning existing payment options for booking ${bookingId}`);
      return existingPayments.map(formatPaymentOption);
    }

    const totalAmount = booking.finalAmount;

    // Validate amount
    if (!totalAmount || totalAmount <= 0) {
      throw new ValidationError('Số tiền booking phải lớn hơn 0');
    }

    if (totalAmount < 1000) {
      throw new ValidationError('Số tiền booking tối thiểu là 1,000 VNĐ');
    }

    const options = [
      { 
        percentage: 30, 
        amount: Math.ceil(totalAmount * 0.3), 
        description: 'Deposit', 
        payType: PAY_TYPE.PREPAY_30 
      },
      { 
        percentage: 50, 
        amount: Math.ceil(totalAmount * 0.5), 
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
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Create payment options failed:', {
      bookingId,
      error: error.message,
      stack: error.stack
    });
    throw new Error('Lỗi khi tạo tùy chọn thanh toán');
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
    // Validate webhook payload
    if (!webhookPayload) {
      throw new ValidationError('Dữ liệu webhook không hợp lệ');
    }

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
        const headerSig = headers['x-payos-signature'] || headers['x-payos-sign'] || null;
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
    const code = body.code; // "00" = success
    const desc = body.desc;

    // Idempotency: try to claim a short-lived key in Redis to avoid duplicate webhook processing
    const idempotencyKey = `payos:webhook:${orderCode}`;
    let claimed = null;
    try {
      claimed = await claimIdempotencyKey(idempotencyKey, 30);
    } catch (err) {
      logger.warn('claimIdempotencyKey threw, continuing without redis claim', { error: err?.message || err });
      claimed = null;
    }

    if (claimed === false) {
      // Another worker already processed this webhook recently
      await session.commitTransaction();
      logger.info(`Duplicate webhook skipped by redis key for orderCode=${orderCode}`);
      return { success: true, message: 'Duplicate webhook skipped' };
    }

    logger.info('Webhook verified', { orderCode, code, desc });

    // Find payment by transaction ID (orderCode)
    const payment = await Payment.findOne({ 
      transactionId: orderCode.toString() 
    }).session(session);

    if (!payment) {
      await session.commitTransaction();
      logger.warn(`Payment not found for orderCode: ${orderCode}`);
      throw new NotFoundError('Không tìm thấy giao dịch thanh toán');
    }

    // Check if already processed to prevent duplicate processing
    if (payment.status === PAYMENT_STATUS.PAID) {
      await session.commitTransaction();
      logger.info(`Payment already processed: ${payment._id}`);
      return { success: true, message: 'Payment already processed' };
    }

    // Update payment based on status
    const isPaid = code === '00'; // PayOS success code

    if (isPaid) {
      payment.status = PAYMENT_STATUS.PAID;
      payment.paidAt = new Date();
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        webhookData: verifiedData,
        webhookAmount: amount,
        completedAt: new Date()
      };
      await payment.save({ session });

      logger.info(`Payment completed: ${payment._id}`);

      // Update booking status
      const booking = await Booking.findById(payment.bookingId).session(session);
      
      if (!booking) {
        logger.error(`Booking not found for payment: ${payment._id}`);
        await session.abortTransaction();
        throw new NotFoundError('Không tìm thấy booking cho giao dịch này');
      }
      
      if (booking) {
        // Calculate total paid amount using find for accuracy
        const paidPayments = await Payment.find({
          bookingId: booking._id,
          status: PAYMENT_STATUS.PAID
        }).select('amount').session(session);

        const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const paymentPercentage = (totalPaid / booking.finalAmount) * 100;

        logger.info(`Booking ${booking._id} payment progress: ${paymentPercentage.toFixed(2)}%`, {
          totalPaid,
          finalAmount: booking.finalAmount
        });

        // Update booking status and payType based on payment progress
        // Use slight tolerance (epsilon) to handle floating point or rounding issues
        if (paymentPercentage >= 99.9) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.payType = PAY_TYPE.FULL;
        } else if (paymentPercentage >= 49.9) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.payType = PAY_TYPE.PREPAY_50;
        } else if (paymentPercentage >= 29.9) {
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
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack
    });
    throw new Error('Lỗi khi xử lý webhook thanh toán');
  } finally {
    session.endSession();
  }
};

/**
 * Get payment status
 * @param {string} paymentId
 */
export const getPaymentStatus = async (paymentId) => {
  try {
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      throw new ValidationError('ID thanh toán không hợp lệ');
    }

    const payment = await Payment.findById(paymentId)
      .populate('bookingId')
      .lean();

    if (!payment) {
      throw new NotFoundError('Thanh toán không tồn tại');
    }

    return payment;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error getting payment status:', error);
    throw new Error('Lỗi khi lấy trạng thái thanh toán');
  }
};

/**
 * Check payment status with PayOS
 * @param {string} orderCode
 */
export const checkPaymentStatusWithPayOS = async (orderCode) => {
  try {
    if (!orderCode) {
      throw new ValidationError('Mã đơn hàng là bắt buộc');
    }

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
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Failed to check PayOS payment status:', {
      orderCode,
      error: error.message
    });
    throw new Error('Lỗi khi kiểm tra trạng thái thanh toán với PayOS');
  }
};

/**
 * Cancel payment
 * @param {string} paymentId
 * @param {string} reason
 */
export const cancelPayment = async (paymentId, reason = 'User cancelled') => {
  try {
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      throw new ValidationError('ID thanh toán không hợp lệ');
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw new NotFoundError('Thanh toán không tồn tại');
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      throw new ValidationError('Không thể hủy thanh toán đã hoàn thành');
    }

    if (payment.status === PAYMENT_STATUS.CANCELLED) {
      throw new ValidationError('Thanh toán đã được hủy trước đó');
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new ValidationError('Chỉ có thể hủy thanh toán đang chờ xử lý');
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
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error canceling payment:', error);
    throw new Error('Lỗi khi hủy thanh toán');
  }
};

/**
 * Create a single payment for a chosen option (idempotent per booking+payType)
 * opts: { percentage, payType }
 */
export const createPaymentForOption = async (bookingId, opts = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ValidationError('ID booking không hợp lệ');
    }

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking không tồn tại');
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ValidationError('Không thể tạo thanh toán cho booking đã hủy');
    }

    const totalAmount = booking.finalAmount;
    if (!totalAmount || totalAmount <= 0) {
      throw new ValidationError('Số tiền booking phải lớn hơn 0');
    }

    if (totalAmount < 1000) {
      throw new ValidationError('Số tiền booking tối thiểu là 1,000 VNĐ');
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
      throw new ValidationError('Phần trăm hoặc loại thanh toán không hợp lệ. Chọn: 30, 50, hoặc 100');
    }

    const amount = payType === PAY_TYPE.FULL ? totalAmount : Math.ceil(totalAmount * (payType === PAY_TYPE.PREPAY_30 ? 0.3 : 0.5));

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
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Create single payment failed:', { bookingId, error: error.message });
    throw new Error('Lỗi khi tạo thanh toán');
  } finally {
    session.endSession();
  }
};

/**
 * Create payment for the remaining amount after existing completed payments
 */
export const createPaymentForRemaining = async (bookingId, opts = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ValidationError('ID booking không hợp lệ');
    }

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'username email')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking không tồn tại');
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ValidationError('Không thể tạo thanh toán cho booking đã hủy');
    }

    // Sum completed payments
    const paidPayments = await Payment.find({
      bookingId: booking._id,
      status: PAYMENT_STATUS.PAID
    }).select('amount').session(session);

    const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = booking.finalAmount - totalPaid;

    // Do not allow creating remaining payment after checkout/completion
    if (booking.status === BOOKING_STATUS.COMPLETED) {
      await session.commitTransaction();
      throw new ValidationError('Không thể tạo thanh toán sau khi hoàn thành booking');
    }

    if (remaining <= 0) {
      await session.commitTransaction();
      throw new ValidationError('Không còn số tiền nào cần thanh toán');
    }

    if (remaining < 1000) {
      throw new ValidationError('Số tiền còn lại tối thiểu là 1,000 VNĐ');
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
    const gatewayResponse = { orderCode, createdAt: new Date(), paymentLinkId: paymentLinkResponse?.paymentLinkId || paymentLinkResponse?.data?.id || null, qrCode: qrCodeUrl, actorId: opts.actorId ? opts.actorId.toString() : undefined };

    if (!checkoutUrl) {
      throw new Error('PayOS did not return a valid checkout URL');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const payment = await Payment.create([{ bookingId, paymentCode, amount: remaining, payType: PAY_TYPE.FULL, status: PAYMENT_STATUS.PENDING, transactionId: orderCode.toString(), qrCodeUrl: checkoutUrl, gatewayResponse, expiresAt }], { session });

    // Audit: push event to booking.events indicating who created the remaining payment
    try {
      if (opts.actorId) {
        booking.events = booking.events || [];
        booking.events.push({
          type: 'PAYMENT_CREATED',
          timestamp: new Date(),
          actorId: opts.actorId,
          details: { amount: remaining, paymentId: payment[0]._id }
        });
        await booking.save({ session });
      }
    } catch (eventErr) {
      logger.warn('Failed to append booking event for remaining payment', { bookingId, error: eventErr?.message || eventErr });
    }

    await session.commitTransaction();

    // Notify customer about remaining payment link (best-effort, outside transaction)
    try {
      const userId = booking.userId?._id || booking.userId;
      if (userId) {
        const message = `Bạn còn ${remaining} VND cần thanh toán cho booking #${booking._id.toString().slice(-8)}. Link thanh toán: ${checkoutUrl}`;
        // sendEmail=false to avoid unexpected emails; frontend can surface link
        await createAndSendNotification(userId, NOTIFICATION_TYPE.INFO, 'Thanh toán phần còn lại', message, false, null, payment[0]._id);
      }
    } catch (notifErr) {
      logger.warn('Failed to notify customer about remaining payment', { bookingId, error: notifErr?.message || notifErr });
    }

    return payment[0];
  } catch (error) {
    await session.abortTransaction();
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Create remaining payment failed:', { bookingId, error: error.message });
    throw new Error('Lỗi khi tạo thanh toán số tiền còn lại');
  } finally {
    session.endSession();
  }
};

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
  // Import and delegate to Refund service
  const { createRefund: createRefundService } = await import('./refund.service.js');
  return await createRefundService(paymentId, opts);
};

/**
 * Get payment history for staff/admin with optimized queries
 * @param {object} filters - Filter options
 * @param {string} filters.status - Payment status filter
 * @param {string} filters.studioId - Studio ID filter
 * @param {Date} filters.startDate - Start date filter
 * @param {Date} filters.endDate - End date filter
 * @param {number} filters.page - Page number (1-based)
 * @param {number} filters.limit - Items per page
 * @returns {object} Paginated payment history
 */
export const getStaffPaymentHistory = async (filters = {}) => {
  try {
    const {
      status,
      studioId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = filters;

    // Validate status if provided
    if (status && !Object.values(PAYMENT_STATUS).includes(status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(PAYMENT_STATUS).join(', ')}`);
    }

    // Validate studioId if provided
    if (studioId && !mongoose.Types.ObjectId.isValid(studioId)) {
      throw new ValidationError('ID studio không hợp lệ');
    }

    // Validate pagination
    const safePage = Math.max(parseInt(page) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // Build base query
    let query = {};

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Handle studio filtering efficiently
  if (studioId) {
    // Get bookings for this studio first (more efficient than nested lookups)
    const bookings = await Booking.find()
      .populate({
        path: 'scheduleId',
        match: { studioId: studioId },
        select: '_id'
      })
      .select('_id scheduleId')
      .lean();

    const bookingIds = bookings
      .filter(b => b.scheduleId) // Only bookings with matching studio
      .map(b => b._id);

    query.bookingId = { $in: bookingIds };
  }

  // Get total count
  const total = await Payment.countDocuments(query);

  // Get payments first (without populate)
  const payments = await Payment.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Batch load all related booking data
  const bookingIds = payments.map(p => p.bookingId);
  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .populate('userId', 'fullName email phone')
    .populate({
      path: 'scheduleId',
      populate: { path: 'studioId', select: 'name location' }
    })
    .select('status totalBeforeDiscount finalAmount userId scheduleId createdAt')
    .lean();

  // Create lookup map for fast access
  const bookingMap = new Map(bookings.map(b => [b._id.toString(), b]));

  // Combine payment data with booking data
  const enrichedPayments = payments.map(payment => ({
    ...payment,
    booking: bookingMap.get(payment.bookingId?.toString()) || null
  }));

  return {
    payments: enrichedPayments,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error getting staff payment history:', error);
    throw new Error('Lỗi khi lấy lịch sử thanh toán');
  }
};

/**
 * Get transactions for customer (my transactions)
 * @param {string} userId - Customer user ID
 * @param {object} filters - Filter options
 * @returns {object} Customer's transaction history
 */
export const getMyTransactions = async (userId, filters = {}) => {
  try {
    if (!userId) {
      throw new ValidationError('ID người dùng là bắt buộc');
    }

    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = filters;

    // Validate status if provided
    if (status && !Object.values(PAYMENT_STATUS).includes(status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(PAYMENT_STATUS).join(', ')}`);
    }

    // Get all bookings for this user
    const userBookings = await Booking.find({ userId })
      .select('_id')
      .lean();

    const bookingIds = userBookings.map(b => b._id);

    if (bookingIds.length === 0) {
      return {
        transactions: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      };
    }

    // Build query
    const query = {
      bookingId: { $in: bookingIds }
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await Payment.countDocuments(query);

    const transactions = await Payment.find(query)
      .populate({
        path: 'bookingId',
        populate: {
          path: 'scheduleId',
          populate: { path: 'studioId', select: 'name location images' }
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in getMyTransactions:', error);
    throw new Error('Lỗi khi lấy lịch sử giao dịch');
  }
};

/**
 * Get all transactions for staff/admin
 * @param {object} filters - Filter options
 * @returns {object} All transactions with details
 */
export const getAllTransactions = async (filters = {}) => {
  try {
    const {
      status,
      payType,
      bookingId,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20
    } = filters;

    // Validate status if provided
    if (status && !Object.values(PAYMENT_STATUS).includes(status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(PAYMENT_STATUS).join(', ')}`);
    }

    // Validate payType if provided
    if (payType && !Object.values(PAY_TYPE).includes(payType)) {
      throw new ValidationError(`Loại thanh toán không hợp lệ. Chọn từ: ${Object.values(PAY_TYPE).join(', ')}`);
    }

    // Build query
    const query = {};

    if (status) query.status = status;
    if (payType) query.payType = payType;
    if (bookingId) query.bookingId = bookingId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      query.amount = {};
      if (minAmount !== undefined && !isNaN(minAmount)) query.amount.$gte = Number(minAmount);
      if (maxAmount !== undefined && !isNaN(maxAmount)) query.amount.$lte = Number(maxAmount);
    }

    // If filtering by userId, get their bookings first
    if (userId) {
      const userBookings = await Booking.find({ userId }).select('_id').lean();
      const bookingIds = userBookings.map(b => b._id);
      query.bookingId = { $in: bookingIds };
    }

    const total = await Payment.countDocuments(query);

    const transactions = await Payment.find(query)
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'userId', select: 'fullName email phone username' },
          {
            path: 'scheduleId',
            populate: { path: 'studioId', select: 'name location images basePricePerHour' }
          }
        ]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalTransactions: total,
        filters: {
          status,
          payType,
          bookingId,
          userId,
          dateRange: startDate || endDate ? {
            startDate: startDate || null,
            endDate: endDate || null
          } : null
        }
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in getAllTransactions:', error);
    throw new Error('Lỗi khi lấy tất cả giao dịch');
  }
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Payment/Transaction ID
 * @param {string} userId - User ID (optional, for customer access control)
 * @param {string} userRole - User role (customer, staff, admin)
 * @returns {object} Transaction details
 */
export const getTransactionById = async (transactionId, userId = null, userRole = null) => {
  try {
    if (!transactionId) {
      throw new ValidationError('ID giao dịch là bắt buộc');
    }

    const transaction = await Payment.findById(transactionId)
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'userId', select: 'fullName email phone username' },
          {
            path: 'scheduleId',
            populate: { path: 'studioId', select: 'name location images basePricePerHour capacity area' }
          }
        ]
      })
      .lean();

    if (!transaction) {
      throw new NotFoundError('Giao dịch không tồn tại');
    }

    // Access control: customers can only view their own transactions
    if (userRole === 'customer' && userId) {
      const booking = transaction.bookingId;
      if (!booking || booking.userId?._id?.toString() !== userId.toString()) {
        throw new ValidationError('Không có quyền xem giao dịch này');
      }
    }

    return transaction;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error in getTransactionById:', error);
    throw new Error('Lỗi khi lấy thông tin giao dịch');
  }
};

/**
 * Delete transaction (staff/admin only)
 * @param {string} transactionId - Transaction ID to delete
 * @returns {object} Deleted transaction
 */
export const deleteTransaction = async (transactionId) => {
  try {
    if (!transactionId) {
      throw new ValidationError('ID giao dịch là bắt buộc');
    }

    const transaction = await Payment.findById(transactionId);

    if (!transaction) {
      throw new NotFoundError('Giao dịch không tồn tại');
    }

    // Only allow deletion of cancelled or failed transactions
    if (transaction.status === PAYMENT_STATUS.PAID) {
      throw new ValidationError('Không thể xóa giao dịch đã thanh toán. Vui lòng tạo hoàn tiền thay vì xóa.');
    }

    await Payment.findByIdAndDelete(transactionId);

    logger.info(`Transaction deleted: ${transactionId}`);

    return transaction;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error in deleteTransaction:', error);
    throw new Error('Lỗi khi xóa giao dịch');
  }
};

/**
 * Delete all cancelled/failed transactions (staff/admin only)
 * @param {object} filters - Filter options
 * @returns {object} Delete result
 */
export const deleteAllCancelledTransactions = async (filters = {}) => {
  try {
    const { beforeDate, bookingId } = filters;

    // Build query - only allow deletion of cancelled/failed transactions
    const query = {
      status: { $in: [PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.FAILED] }
    };

    if (beforeDate) {
      query.createdAt = { $lt: new Date(beforeDate) };
    }

    if (bookingId) {
      query.bookingId = bookingId;
    }

    const count = await Payment.countDocuments(query);

    if (count === 0) {
      return {
        success: true,
        deletedCount: 0,
        message: 'Không có giao dịch nào để xóa'
      };
    }

    const result = await Payment.deleteMany(query);

    logger.info(`Bulk delete transactions: ${result.deletedCount} transactions deleted`);

    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `Đã xóa ${result.deletedCount} giao dịch đã hủy/thất bại`
    };
  } catch (error) {
    logger.error('Error in deleteAllCancelledTransactions:', error);
    throw new Error('Lỗi khi xóa các giao dịch');
  }
};

/**
 * Get transaction history with statistics
 * @param {object} filters - Filter options
 * @returns {object} Transaction history with stats
 */
export const getTransactionHistory = async (filters = {}) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      status,
      groupBy = 'day', // day, week, month
      page = 1,
      limit = 50
    } = filters;

    // Build base query
    const query = {};

    if (userId) {
      const userBookings = await Booking.find({ userId }).select('_id').lean();
      const bookingIds = userBookings.map(b => b._id);
      query.bookingId = { $in: bookingIds };
    }

    if (status) {
      if (!Object.values(PAYMENT_STATUS).includes(status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(PAYMENT_STATUS).join(', ')}`);
      }
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get transactions
    const total = await Payment.countDocuments(query);

    const transactions = await Payment.find(query)
      .populate({
        path: 'bookingId',
        populate: {
          path: 'scheduleId',
          populate: { path: 'studioId', select: 'name' }
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Calculate statistics
    const allTransactions = await Payment.find(query).select('amount status createdAt payType').lean();

    const stats = {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      cancelledAmount: 0,
      totalPaidTransactions: 0,
      totalPendingTransactions: 0,
      totalCancelledTransactions: 0,
      byPayType: {}
    };

    allTransactions.forEach(t => {
      stats.totalAmount += t.amount || 0;
      
      if (t.status === PAYMENT_STATUS.PAID) {
        stats.paidAmount += t.amount || 0;
        stats.totalPaidTransactions++;
      } else if (t.status === PAYMENT_STATUS.PENDING) {
        stats.pendingAmount += t.amount || 0;
        stats.totalPendingTransactions++;
      } else if (t.status === PAYMENT_STATUS.CANCELLED) {
        stats.cancelledAmount += t.amount || 0;
        stats.totalCancelledTransactions++;
      }

      // Group by payType
      if (t.payType) {
        if (!stats.byPayType[t.payType]) {
          stats.byPayType[t.payType] = { count: 0, amount: 0 };
        }
        stats.byPayType[t.payType].count++;
        stats.byPayType[t.payType].amount += t.amount || 0;
      }
    });

    // Group by time period
    const groupedData = {};
    allTransactions.forEach(t => {
      if (!t.createdAt) return;

      const date = new Date(t.createdAt);
      let key;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = { count: 0, amount: 0, paid: 0, pending: 0, cancelled: 0 };
      }

      groupedData[key].count++;
      groupedData[key].amount += t.amount || 0;
      
      if (t.status === PAYMENT_STATUS.PAID) groupedData[key].paid++;
      else if (t.status === PAYMENT_STATUS.PENDING) groupedData[key].pending++;
      else if (t.status === PAYMENT_STATUS.CANCELLED) groupedData[key].cancelled++;
    });

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      statistics: stats,
      timeline: Object.entries(groupedData)
        .map(([period, data]) => ({ period, ...data }))
        .sort((a, b) => b.period.localeCompare(a.period))
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in getTransactionHistory:', error);
    throw new Error('Lỗi khi lấy lịch sử giao dịch');
  }
};