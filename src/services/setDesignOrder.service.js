//#region Imports
import mongoose from 'mongoose';
import crypto from 'crypto';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import SetDesignOrder, { SET_DESIGN_ORDER_STATUS } from '../models/SetDesignOrder/setDesignOrder.model.js';
import SetDesignPayment from '../models/SetDesignPayment/setDesignPayment.model.js';
import payos, { getPayOSCreatePaymentFn } from '../config/payos.js';
import { PAYMENT_STATUS, PAY_TYPE } from '../utils/constants.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
//#endregion

// PayOS description maximum length
const PAYOS_DESCRIPTION_MAX = 25;

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len) : str);

/**
 * Generate unique order code for PayOS
 * PayOS requires: positive integer, max 9007199254740991
 */
const generateOrderCode = () => {
  // Use timestamp in seconds + random to keep number smaller
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 10000); // 0-9999
  return Number(`${timestampSeconds}${random.toString().padStart(4, '0')}`);
};

/**
 * Generate unique payment code
 */
const generatePaymentCode = (orderId, percentage) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SDP-${timestamp}-${percentage}-${random}`;
};

//#region Order Management

/**
 * Create a new set design order
 * @param {Object} orderData - Order data
 * @param {Object} user - Current user
 * @returns {Object} Created order
 */
export const createSetDesignOrder = async (orderData, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { setDesignId, quantity = 1, customerNotes, usageDate, bookingId } = orderData;

    // Validate set design exists and is active
    if (!setDesignId || !mongoose.Types.ObjectId.isValid(setDesignId)) {
      throw new ValidationError('ID set design không hợp lệ');
    }

    const setDesign = await SetDesign.findById(setDesignId).session(session);
    if (!setDesign) {
      throw new NotFoundError('Set design không tồn tại');
    }
    if (!setDesign.isActive) {
      throw new ValidationError('Set design này hiện không khả dụng');
    }
    if (!setDesign.price || setDesign.price <= 0) {
      throw new ValidationError('Set design này chưa có giá, vui lòng liên hệ nhân viên');
    }

    // Validate quantity
    if (quantity < 1 || quantity > 10) {
      throw new ValidationError('Số lượng phải từ 1 đến 10');
    }

    // Generate order code
    const orderCode = SetDesignOrder.generateOrderCode();

    // Create order
    const order = new SetDesignOrder({
      orderCode,
      customerId: user._id,
      setDesignId,
      bookingId: bookingId || null,
      quantity,
      unitPrice: setDesign.price,
      totalAmount: quantity * setDesign.price,
      customerNotes,
      usageDate: usageDate ? new Date(usageDate) : null,
      status: SET_DESIGN_ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });

    await order.save({ session });

    await session.commitTransaction();

    logger.info(`Set design order created: ${orderCode} by user: ${user._id}`);

    // Populate and return
    const populatedOrder = await SetDesignOrder.findById(order._id)
      .populate('setDesignId', 'name images price category')
      .populate('customerId', 'username email');

    return populatedOrder;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create set design order error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    } else {
      throw new Error('Lỗi khi tạo đơn hàng set design');
    }
  } finally {
    session.endSession();
  }
};

/**
 * Get all orders for current customer
 * @param {Object} user - Current user
 * @param {Object} options - Query options
 * @returns {Object} Paginated orders
 */
export const getMySetDesignOrders = async (user, options = {}) => {
  try {
    const { page = 1, limit = 10, status } = options;

    const query = { customerId: user._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      SetDesignOrder.find(query)
        .populate('setDesignId', 'name images price category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SetDesignOrder.countDocuments(query),
    ]);

    return {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Get my set design orders error:', error);
    throw new Error('Lỗi khi lấy danh sách đơn hàng');
  }
};

/**
 * Get all orders (Staff/Admin)
 * @param {Object} options - Query options
 * @returns {Object} Paginated orders
 */
export const getAllSetDesignOrders = async (options = {}) => {
  try {
    const { page = 1, limit = 10, status, customerId } = options;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (customerId) {
      query.customerId = customerId;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      SetDesignOrder.find(query)
        .populate('setDesignId', 'name images price category')
        .populate('customerId', 'username email')
        .populate('processedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SetDesignOrder.countDocuments(query),
    ]);

    return {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Get all set design orders error:', error);
    throw new Error('Lỗi khi lấy danh sách đơn hàng');
  }
};

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @param {Object} user - Current user
 * @returns {Object} Order details
 */
export const getSetDesignOrderById = async (orderId, user) => {
  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await SetDesignOrder.findById(orderId)
      .populate('setDesignId', 'name images price category description')
      .populate('customerId', 'username email')
      .populate('processedBy', 'username');

    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    // Check ownership for customers
    const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';
    if (!isStaffOrAdmin && order.customerId._id.toString() !== user._id.toString()) {
      throw new ValidationError('Bạn không có quyền xem đơn hàng này');
    }

    // Get payments for this order
    const payments = await SetDesignPayment.find({ orderId }).sort({ createdAt: -1 });

    return { order, payments };
  } catch (error) {
    logger.error('Get set design order by ID error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin đơn hàng');
  }
};

/**
 * Update order status (Staff/Admin)
 * @param {string} orderId - Order ID
 * @param {Object} updateData - Update data
 * @param {Object} user - Current user (staff)
 * @returns {Object} Updated order
 */
export const updateSetDesignOrderStatus = async (orderId, updateData, user) => {
  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await SetDesignOrder.findById(orderId);
    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    const { status, staffNotes } = updateData;

    // Validate status transition
    const validTransitions = {
      [SET_DESIGN_ORDER_STATUS.PENDING]: [SET_DESIGN_ORDER_STATUS.CANCELLED],
      [SET_DESIGN_ORDER_STATUS.CONFIRMED]: [SET_DESIGN_ORDER_STATUS.PROCESSING, SET_DESIGN_ORDER_STATUS.CANCELLED],
      [SET_DESIGN_ORDER_STATUS.PROCESSING]: [SET_DESIGN_ORDER_STATUS.READY, SET_DESIGN_ORDER_STATUS.CANCELLED],
      [SET_DESIGN_ORDER_STATUS.READY]: [SET_DESIGN_ORDER_STATUS.COMPLETED],
      [SET_DESIGN_ORDER_STATUS.COMPLETED]: [],
      [SET_DESIGN_ORDER_STATUS.CANCELLED]: [],
    };

    if (status && !validTransitions[order.status]?.includes(status)) {
      throw new ValidationError(`Không thể chuyển từ trạng thái '${order.status}' sang '${status}'`);
    }

    // Update order
    if (status) {
      order.status = status;
      order.processedBy = user._id;

      if (status === SET_DESIGN_ORDER_STATUS.CONFIRMED) {
        order.confirmedAt = new Date();
      } else if (status === SET_DESIGN_ORDER_STATUS.COMPLETED) {
        order.completedAt = new Date();
      } else if (status === SET_DESIGN_ORDER_STATUS.CANCELLED) {
        order.cancelledAt = new Date();
        order.cancelReason = updateData.cancelReason || 'Cancelled by staff';
      }
    }

    if (staffNotes) {
      order.staffNotes = staffNotes;
    }

    await order.save();

    logger.info(`Set design order ${orderId} status updated to ${status} by ${user._id}`);

    return await SetDesignOrder.findById(orderId)
      .populate('setDesignId', 'name images price category')
      .populate('customerId', 'username email')
      .populate('processedBy', 'username');
  } catch (error) {
    logger.error('Update set design order status error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật trạng thái đơn hàng');
  }
};

/**
 * Cancel order (Customer - only pending orders)
 * @param {string} orderId - Order ID
 * @param {Object} user - Current user
 * @param {string} reason - Cancel reason
 * @returns {Object} Cancelled order
 */
export const cancelSetDesignOrder = async (orderId, user, reason) => {
  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await SetDesignOrder.findById(orderId);
    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    // Check ownership
    if (order.customerId.toString() !== user._id.toString()) {
      throw new ValidationError('Bạn không có quyền hủy đơn hàng này');
    }

    // Only pending orders can be cancelled by customer
    if (order.status !== SET_DESIGN_ORDER_STATUS.PENDING) {
      throw new ValidationError('Chỉ có thể hủy đơn hàng đang chờ thanh toán');
    }

    order.status = SET_DESIGN_ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';

    await order.save();

    logger.info(`Set design order ${orderId} cancelled by customer ${user._id}`);

    return order;
  } catch (error) {
    logger.error('Cancel set design order error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi hủy đơn hàng');
  }
};

//#endregion

//#region Payment Management

/**
 * Create payment for set design order
 * @param {string} orderId - Order ID
 * @param {Object} paymentData - Payment data
 * @param {Object} user - Current user
 * @returns {Object} Payment with checkout URL
 */
export const createSetDesignPayment = async (orderId, paymentData, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await SetDesignOrder.findById(orderId)
      .populate('setDesignId', 'name')
      .populate('customerId', 'username email')
      .session(session);

    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    // Check ownership for customers
    const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';
    if (!isStaffOrAdmin && order.customerId._id.toString() !== user._id.toString()) {
      throw new ValidationError('Bạn không có quyền thanh toán đơn hàng này');
    }

    // Check order status
    if (order.status === SET_DESIGN_ORDER_STATUS.CANCELLED) {
      throw new ValidationError('Không thể thanh toán đơn hàng đã hủy');
    }

    // Only allow payment for orders in PENDING or CONFIRMED status
    const allowedStatusesForPayment = [
      SET_DESIGN_ORDER_STATUS.PENDING,
      SET_DESIGN_ORDER_STATUS.CONFIRMED,
    ];
    if (!allowedStatusesForPayment.includes(order.status)) {
      throw new ValidationError('Không thể thanh toán cho đơn hàng ở trạng thái hiện tại');
    }
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      throw new ValidationError('Đơn hàng đã được thanh toán');
    }

    // Check for existing pending payment
    const existingPayment = await SetDesignPayment.findOne({
      orderId,
      status: PAYMENT_STATUS.PENDING,
    }).session(session);

    if (existingPayment) {
      await session.commitTransaction();
      return {
        payment: existingPayment,
        checkoutUrl: existingPayment.qrCodeUrl,
        message: 'Đã có link thanh toán cho đơn hàng này',
      };
    }

    // Calculate remaining amount
    const remainingAmount = order.totalAmount - order.paidAmount;
    if (remainingAmount <= 0) {
      throw new ValidationError('Đơn hàng đã được thanh toán đầy đủ');
    }

    // Determine payment type and amount
    const { payType = PAY_TYPE.FULL } = paymentData;
    let paymentAmount = remainingAmount;

    // For partial payments, ensure sum of payments does not exceed total due to rounding.
    if (payType === PAY_TYPE.PREPAY_30) {
      // Prepayment: 30% rounded up
      paymentAmount = Math.ceil(order.totalAmount * 0.3);
      // If this is not the first payment, pay the exact remaining amount
      if (order.paidAmount > 0) {
        paymentAmount = remainingAmount;
      }
    } else if (payType === PAY_TYPE.PREPAY_50) {
      // Prepayment: 50% rounded up
      paymentAmount = Math.ceil(order.totalAmount * 0.5);
      // If this is not the first payment, pay the exact remaining amount
      if (order.paidAmount > 0) {
        paymentAmount = remainingAmount;
      }
    }
    // Don't pay more than remaining (redundant, but kept for safety)
    paymentAmount = Math.min(paymentAmount, remainingAmount);

    if (paymentAmount < 1000) {
      throw new ValidationError('Số tiền thanh toán tối thiểu là 1,000 VNĐ');
    }

    // Generate codes
    const payosOrderCode = generateOrderCode();
    const paymentCode = generatePaymentCode(orderId, payType === PAY_TYPE.FULL ? 100 : payType === PAY_TYPE.PREPAY_50 ? 50 : 30);

    // Create PayOS payment link
    let checkoutUrl = null;
    let qrCodeUrl = null;
    let gatewayResponse = {
      orderCode: payosOrderCode,
      createdAt: new Date(),
    };

    try {
      const fullDescription = `Set Design: ${order.setDesignId?.name || 'Order'} - ${order.orderCode}`;
      const safeDescription = truncate(fullDescription, PAYOS_DESCRIPTION_MAX);

      const paymentRequestData = {
        orderCode: payosOrderCode,
        amount: paymentAmount,
        description: safeDescription,
        items: (() => {
          const items = [];
          const basePrice = Math.floor(paymentAmount / order.quantity);
          const remainder = paymentAmount - basePrice * order.quantity;
          
          // Add payment type info to item name for clarity
          let itemNameSuffix = '';
          if (payType === PAY_TYPE.PREPAY_30) {
            itemNameSuffix = ' (30% Prepay)';
          } else if (payType === PAY_TYPE.PREPAY_50) {
            itemNameSuffix = ' (50% Prepay)';
          } else if (paymentAmount < order.totalAmount) {
            itemNameSuffix = ' (Remaining)';
          }
          
          for (let i = 0; i < order.quantity; i++) {
            items.push({
              name: truncate((order.setDesignId?.name || 'Set Design') + itemNameSuffix, 50),
              quantity: 1,
              price: i === order.quantity - 1 ? basePrice + remainder : basePrice,
            });
          }
          return items;
        })(),
        returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/set-design/payment/success?orderId=${orderId}`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/set-design/payment/cancel?orderId=${orderId}`,
        buyerName: order.customerId?.username || 'Customer',
        buyerEmail: order.customerId?.email || undefined,
      };

      logger.info('Creating PayOS payment link for set design order', {
        orderCode: payosOrderCode,
        amount: paymentAmount,
      });

      const createPaymentLinkFn = getPayOSCreatePaymentFn();
      const paymentLinkResponse = await createPaymentLinkFn(paymentRequestData);

      if (!paymentLinkResponse || !paymentLinkResponse.checkoutUrl) {
        throw new Error('PayOS did not return a valid payment link response');
      }

      checkoutUrl = paymentLinkResponse.checkoutUrl;
      qrCodeUrl = paymentLinkResponse?.qrCode || paymentLinkResponse?.data?.qrCode || null;
      gatewayResponse = {
        ...gatewayResponse,
        paymentLinkId: paymentLinkResponse?.paymentLinkId || paymentLinkResponse?.data?.id || null,
        qrCode: qrCodeUrl,
      };

      if (!checkoutUrl) {
        throw new Error('PayOS did not return a valid checkout URL');
      }
    } catch (payosError) {
      logger.error('PayOS API Error for set design:', {
        message: payosError.message,
        orderCode: payosOrderCode,
      });
      throw new Error(`Payment gateway error: ${payosError.message}`);
    }

    // Create payment record
    const payment = new SetDesignPayment({
      orderId,
      paymentCode,
      amount: paymentAmount,
      payType,
      status: PAYMENT_STATUS.PENDING,
      transactionId: payosOrderCode.toString(),
      qrCodeUrl: checkoutUrl,
      gatewayResponse,
    });

    await payment.save({ session });

    await session.commitTransaction();

    logger.info('Set design payment created', {
      paymentId: payment._id,
      orderId,
      amount: paymentAmount,
    });

    return {
      payment,
      checkoutUrl,
      qrCode: qrCodeUrl,
      amount: paymentAmount,
      orderCode: payosOrderCode,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create set design payment error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo thanh toán');
  } finally {
    session.endSession();
  }
};

/**
 * Verify PayOS webhook signature
 * @param {Object} body - Webhook body
 * @returns {boolean} Is signature valid
 */
const verifyPayOSWebhookSignature = (body) => {
  try {
    const signature = body.signature;
    if (!signature || !process.env.PAYOS_CHECKSUM_KEY || !body.data) {
      return false;
    }

    // PayOS signature: sorted key=value from body.data, null/undefined as empty string
    const dataToSign = Object.keys(body.data)
      .sort()
      .map(key => {
        const value = body.data[key];
        if (value === null || value === undefined) {
          return `${key}=`;
        }
        const serializedValue = typeof value === 'object' 
          ? JSON.stringify(value) 
          : String(value);
        return `${key}=${serializedValue}`;
      })
      .join('&');

    const computedSignature = crypto
      .createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY)
      .update(dataToSign)
      .digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const computedBuffer = Buffer.from(computedSignature.toLowerCase(), 'utf8');
    const receivedBuffer = Buffer.from(signature.toString().toLowerCase(), 'utf8');
    if (computedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedBuffer, receivedBuffer);
  } catch (error) {
    logger.error('Webhook signature verification error:', error);
    return false;
  }
};

/**
 * Handle PayOS webhook for set design payment
 * @param {Object} webhookPayload - Webhook payload from PayOS
 * @returns {Object} Webhook processing result
 */
export const handleSetDesignPaymentWebhook = async (webhookPayload) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const body = webhookPayload?.body || webhookPayload || {};
    const { orderCode, code, desc, data } = body;

    // Verify webhook signature (signature is in body.signature per PayOS format)
    if (!verifyPayOSWebhookSignature(body)) {
      logger.warn('Invalid PayOS webhook signature', { orderCode });
      throw new ValidationError('Invalid webhook signature');
    }

    logger.info('Processing set design payment webhook', { orderCode, code });

    // Find payment by transaction ID
    const transactionId = orderCode?.toString() || data?.orderCode?.toString();
    if (!transactionId) {
      throw new ValidationError('Missing orderCode in webhook');
    }

    const payment = await SetDesignPayment.findOne({ transactionId }).session(session);
    if (!payment) {
      // Not a set design payment, ignore (generic response to prevent info leakage)
      await session.commitTransaction();
      return { success: true };
    }

    // Check if already processed
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      await session.commitTransaction();
      return { success: true };
    }

    // Update payment status based on webhook
    const isSuccess = code === '00' ;

    if (isSuccess) {
      payment.status = PAYMENT_STATUS.PAID;
      payment.paidAt = new Date();
      payment.gatewayResponse = { ...payment.gatewayResponse, webhook: body };

      // Update order
      const order = await SetDesignOrder.findById(payment.orderId).session(session);
      if (order) {
        // Prevent paidAmount from exceeding totalAmount (protection against race conditions/duplicate webhooks)
        order.paidAmount = Math.min(order.paidAmount + payment.amount, order.totalAmount);
        
        // Check if fully paid
        if (order.paidAmount >= order.totalAmount) {
          order.paymentStatus = PAYMENT_STATUS.PAID;
          order.status = SET_DESIGN_ORDER_STATUS.CONFIRMED;
          order.confirmedAt = new Date();
        }
        
        await order.save({ session });
      }

      await payment.save({ session });
      await session.commitTransaction();

      logger.info(`Set design payment ${payment._id} marked as PAID`);

      // Send notification after transaction commit
      // Note: If notification sending fails, payment status remains PAID and user may not be notified.
      // This is acceptable as payment processing is critical, while notifications are supplementary.
      // Failed notifications are logged and can be retried via admin dashboard or background job.
      try {
        if (order) {
          await createAndSendNotification({
            userId: order.customerId,
            type: NOTIFICATION_TYPE.PAYMENT_SUCCESS,
            data: {
              orderId: order._id,
              orderCode: order.orderCode,
              paymentId: payment._id,
              amount: payment.amount,
              message: `Thanh toán ${payment.amount.toLocaleString()} VND cho đơn hàng ${order.orderCode} đã thành công`,
            },
          });
        }
      } catch (notifyErr) {
        logger.error('Failed to send payment success notification', { 
          error: notifyErr.message, 
          paymentId: payment._id,
          orderId: order?._id 
        });
        // Payment is already committed, notification failure is logged but does not affect payment status
        // Consider implementing retry logic via background job or admin alert for production
      }

      return { success: true };
    } else {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = { ...payment.gatewayResponse, webhook: body };
      await payment.save({ session });
      await session.commitTransaction();

      logger.info(`Set design payment ${payment._id} marked as FAILED`);

      return { success: true };
    }
  } catch (error) {
    await session.abortTransaction();
    logger.error('Handle set design payment webhook error:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get payment status for set design order
 * @param {string} paymentId - Payment ID
 * @returns {Object} Payment status
 */
export const getSetDesignPaymentStatus = async (paymentId) => {
  try {
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      throw new ValidationError('ID thanh toán không hợp lệ');
    }

    const payment = await SetDesignPayment.findById(paymentId).populate('orderId');
    if (!payment) {
      throw new NotFoundError('Thanh toán không tồn tại');
    }

    return payment;
  } catch (error) {
    logger.error('Get set design payment status error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy trạng thái thanh toán');
  }
};

/**
 * Get all payments for an order
 * @param {string} orderId - Order ID
 * @returns {Array} Payments
 */
export const getSetDesignOrderPayments = async (orderId) => {
  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const payments = await SetDesignPayment.find({ orderId }).sort({ createdAt: -1 });
    return payments;
  } catch (error) {
    logger.error('Get set design order payments error:', error);
    throw new Error('Lỗi khi lấy danh sách thanh toán');
  }
};

//#endregion

export default {
  createSetDesignOrder,
  getMySetDesignOrders,
  getAllSetDesignOrders,
  getSetDesignOrderById,
  updateSetDesignOrderStatus,
  cancelSetDesignOrder,
  createSetDesignPayment,
  handleSetDesignPaymentWebhook,
  getSetDesignPaymentStatus,
  getSetDesignOrderPayments,
};
