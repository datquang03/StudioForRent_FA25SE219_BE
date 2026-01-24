//#region Imports
import mongoose from 'mongoose';
import crypto from 'crypto';
import Equipment from '../models/Equipment/equipment.model.js';
import EquipmentOrder, { EQUIPMENT_ORDER_STATUS } from '../models/EquipmentOrder/equipmentOrder.model.js';
import Payment from '../models/Payment/payment.model.js';
import { PAYMENT_STATUS, PAY_TYPE, TARGET_MODEL, PAYMENT_CATEGORY, NOTIFICATION_TYPE } from '../utils/constants.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { createAndSendNotification } from './notification.service.js';
//#endregion

// PayOS description maximum length
const PAYOS_DESCRIPTION_MAX = 25;

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len) : str);

/**
 * Generate unique order code for PayOS
 */
const generateOrderCode = () => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(2).readUInt16BE(0) % 1000;
  return Number(`${timestamp}${random.toString().padStart(3, '0')}`);
};

/**
 * Generate unique payment code
 */
const generatePaymentCode = (orderId) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EQP-${timestamp}-${random}`;
};

//#region Order Management

/**
 * Create a new equipment order
 * @param {Object} orderData - Order data
 * @param {Object} user - Current user
 * @returns {Object} Created order
 */
export const createEquipmentOrder = async (orderData, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { equipmentId, quantity = 1, hours, rentalStartTime, rentalEndTime, customerNotes, bookingId } = orderData;

    // Validate equipment exists and is available
    if (!equipmentId || !mongoose.Types.ObjectId.isValid(equipmentId)) {
      throw new ValidationError('ID thiết bị không hợp lệ');
    }

    const equipment = await Equipment.findById(equipmentId).session(session);
    if (!equipment) {
      throw new NotFoundError('Thiết bị không tồn tại');
    }
    if (equipment.isDeleted || equipment.status !== 'available') {
      throw new ValidationError('Thiết bị này hiện không khả dụng');
    }
    if (!equipment.pricePerHour || equipment.pricePerHour <= 0) {
      throw new ValidationError('Thiết bị này chưa có giá thuê');
    }

    // Validate quantity
    if (quantity < 1 || quantity > 100) {
      throw new ValidationError('Số lượng phải từ 1 đến 100');
    }
    if (equipment.availableQty < quantity) {
      throw new ValidationError(`Chỉ còn ${equipment.availableQty} thiết bị khả dụng`);
    }

    // Validate hours
    if (!hours || hours < 1 || hours > 720) {
      throw new ValidationError('Số giờ thuê phải từ 1 đến 720 (30 ngày)');
    }

    // Validate rental times
    const startTime = new Date(rentalStartTime);
    const endTime = new Date(rentalEndTime);
    const now = new Date();

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new ValidationError('Thời gian thuê không hợp lệ');
    }
    if (startTime < now) {
      throw new ValidationError('Thời gian bắt đầu thuê phải sau thời điểm hiện tại');
    }
    if (endTime <= startTime) {
      throw new ValidationError('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    // Calculate hours difference
    const hoursDiff = Math.ceil((endTime - startTime) / (1000 * 60 * 60));
    if (hoursDiff !== hours) {
      throw new ValidationError(`Số giờ thuê không khớp với khoảng thời gian (${hoursDiff} giờ)`);
    }

    // Generate order code
    const orderCode = EquipmentOrder.generateOrderCode();

    // Calculate total amount
    const totalAmount = quantity * hours * equipment.pricePerHour;

    // Create order
    const order = new EquipmentOrder({
      orderCode,
      customerId: user._id,
      equipmentId,
      bookingId: bookingId || null,
      quantity,
      hours,
      unitPrice: equipment.pricePerHour,
      totalAmount,
      rentalStartTime: startTime,
      rentalEndTime: endTime,
      customerNotes,
      status: EQUIPMENT_ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });

    await order.save({ session });

    // Reserve equipment (decrease availableQty, increase inUseQty)
    equipment.availableQty -= quantity;
    equipment.inUseQty += quantity;
    await equipment.save({ session });

    await session.commitTransaction();

    logger.info(`Equipment order created: ${orderCode} by user: ${user._id}`);

    // Populate and return
    const populatedOrder = await EquipmentOrder.findById(order._id)
      .populate('equipmentId', 'name image pricePerHour')
      .populate('customerId', 'username email');

    return populatedOrder;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create equipment order error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    } else {
      throw new Error('Lỗi khi tạo đơn thuê thiết bị');
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
export const getMyEquipmentOrders = async (user, options = {}) => {
  try {
    const { page = 1, limit = 10, status } = options;

    const query = { customerId: user._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      EquipmentOrder.find(query)
        .populate('equipmentId', 'name image pricePerHour')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EquipmentOrder.countDocuments(query),
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
    logger.error('Get my equipment orders error:', error);
    throw new Error('Lỗi khi lấy danh sách đơn thuê');
  }
};

/**
 * Get all orders (Staff/Admin)
 * @param {Object} options - Query options
 * @returns {Object} Paginated orders
 */
export const getAllEquipmentOrders = async (options = {}) => {
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
      EquipmentOrder.find(query)
        .populate('equipmentId', 'name image pricePerHour')
        .populate('customerId', 'username email')
        .populate('processedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EquipmentOrder.countDocuments(query),
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
    logger.error('Get all equipment orders error:', error);
    throw new Error('Lỗi khi lấy danh sách đơn thuê');
  }
};

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @param {Object} user - Current user
 * @returns {Object} Order details
 */
export const getEquipmentOrderById = async (orderId, user) => {
  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await EquipmentOrder.findById(orderId)
      .populate('equipmentId', 'name image pricePerHour description')
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
    const payments = await Payment.find({ targetId: orderId, targetModel: TARGET_MODEL.EQUIPMENT_ORDER }).sort({ createdAt: -1 });

    return { order, payments };
  } catch (error) {
    logger.error('Get equipment order by ID error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin đơn thuê');
  }
};

/**
 * Update order status (Staff/Admin)
 * @param {string} orderId - Order ID
 * @param {Object} updateData - Update data
 * @param {Object} user - Current user (staff)
 * @returns {Object} Updated order
 */
export const updateEquipmentOrderStatus = async (orderId, updateData, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await EquipmentOrder.findById(orderId)
      .populate('equipmentId')
      .session(session);
    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    const { status, staffNotes } = updateData;

    // Validate status transition
    const validTransitions = {
      [EQUIPMENT_ORDER_STATUS.PENDING]: [EQUIPMENT_ORDER_STATUS.CONFIRMED, EQUIPMENT_ORDER_STATUS.CANCELLED],
      [EQUIPMENT_ORDER_STATUS.CONFIRMED]: [EQUIPMENT_ORDER_STATUS.IN_USE, EQUIPMENT_ORDER_STATUS.CANCELLED],
      [EQUIPMENT_ORDER_STATUS.IN_USE]: [EQUIPMENT_ORDER_STATUS.COMPLETED],
      [EQUIPMENT_ORDER_STATUS.COMPLETED]: [],
      [EQUIPMENT_ORDER_STATUS.CANCELLED]: [],
    };

    if (status && !validTransitions[order.status]?.includes(status)) {
      throw new ValidationError(`Không thể chuyển từ trạng thái '${order.status}' sang '${status}'`);
    }

    // Update order
    if (status) {
      order.status = status;
      order.processedBy = user._id;

      if (status === EQUIPMENT_ORDER_STATUS.CONFIRMED) {
        order.confirmedAt = new Date();
      } else if (status === EQUIPMENT_ORDER_STATUS.IN_USE) {
        order.startedAt = new Date();
      } else if (status === EQUIPMENT_ORDER_STATUS.COMPLETED) {
        order.completedAt = new Date();
        // Return equipment to available (decrease inUseQty, increase availableQty)
        const equipment = order.equipmentId;
        equipment.inUseQty -= order.quantity;
        equipment.availableQty += order.quantity;
        await equipment.save({ session });
      } else if (status === EQUIPMENT_ORDER_STATUS.CANCELLED) {
        order.cancelledAt = new Date();
        order.cancelReason = updateData.cancelReason || 'Cancelled by staff';
        // Return equipment to available
        const equipment = order.equipmentId;
        equipment.inUseQty -= order.quantity;
        equipment.availableQty += order.quantity;
        await equipment.save({ session });
      }
    }

    if (staffNotes) {
      order.staffNotes = staffNotes;
    }

    await order.save({ session });
    await session.commitTransaction();

    logger.info(`Equipment order ${orderId} status updated to ${status} by ${user._id}`);

    return await EquipmentOrder.findById(orderId)
      .populate('equipmentId', 'name image pricePerHour')
      .populate('customerId', 'username email')
      .populate('processedBy', 'username');
  } catch (error) {
    await session.abortTransaction();
    logger.error('Update equipment order status error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật trạng thái đơn thuê');
  } finally {
    session.endSession();
  }
};

/**
 * Cancel order (Customer - only pending orders)
 * @param {string} orderId - Order ID
 * @param {Object} user - Current user
 * @param {string} reason - Cancel reason
 * @returns {Object} Cancelled order
 */
export const cancelEquipmentOrder = async (orderId, user, reason) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await EquipmentOrder.findById(orderId)
      .populate('equipmentId')
      .session(session);
    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    // Check ownership
    if (order.customerId.toString() !== user._id.toString()) {
      throw new ValidationError('Bạn không có quyền hủy đơn hàng này');
    }

    // Only pending orders can be cancelled by customer
    if (order.status !== EQUIPMENT_ORDER_STATUS.PENDING) {
      throw new ValidationError('Chỉ có thể hủy đơn hàng đang chờ thanh toán');
    }

    order.status = EQUIPMENT_ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';

    await order.save({ session });

    // Return equipment to available
    const equipment = order.equipmentId;
    equipment.inUseQty -= order.quantity;
    equipment.availableQty += order.quantity;
    await equipment.save({ session });

    await session.commitTransaction();

    logger.info(`Equipment order ${orderId} cancelled by customer ${user._id}`);

    return order;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Cancel equipment order error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi hủy đơn thuê');
  } finally {
    session.endSession();
  }
};

//#endregion

//#region Payment Management

/**
 * Refund equipment deposit (Auto or Manual)
 * @param {string} orderId 
 * @param {Object} user (Staff)
 */
export const refundEquipmentDeposit = async (orderId, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await EquipmentOrder.findById(orderId).session(session);
        if (!order) throw new NotFoundError('Order not found');
        
        // Check valid status to refund (COMPLETED means returned)
        if (order.status !== EQUIPMENT_ORDER_STATUS.COMPLETED) {
            throw new ValidationError('Chỉ có thể hoàn cọc sau khi đơn hàng đã hoàn thành (đã trả đồ)');
        }

        const deposit = order.depositAmount || 0;
        if (deposit <= 0) {
             throw new ValidationError('Đơn hàng này không có tiền cọc để hoàn');
        }

        // Find PAID payments and validate
        const paidPayments = await Payment.find({
            targetId: orderId,
            targetModel: 'EquipmentOrder',
            status: PAYMENT_STATUS.PAID
        }).session(session);

        // Validate: must have paid payments
        if (!paidPayments || paidPayments.length === 0) {
            throw new ValidationError('Không có thanh toán nào cho đơn hàng này');
        }

        // Validate: total paid >= deposit
        const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
        if (totalPaid < deposit) {
            throw new ValidationError('Số tiền đã thu nhỏ hơn tiền cọc');
        }

        // Check existing refund to prevent duplicate (Issue #4)
        const existingRefund = await Payment.findOne({
            targetId: orderId,
            targetModel: TARGET_MODEL.EQUIPMENT_ORDER,
            status: PAYMENT_STATUS.REFUNDED
        }).session(session);

        if (existingRefund) {
            throw new ValidationError('Tiền cọc cho đơn hàng này đã được hoàn trước đó');
        }

        // Create refund record with unique paymentCode (Issue #4: add timestamp)
        const refundTransId = `REF-${Date.now()}`;
        const refundPayment = await Payment.create([{
            targetId: orderId,
            targetModel: TARGET_MODEL.EQUIPMENT_ORDER,
            category: PAYMENT_CATEGORY.EQUIPMENT,
            paymentCode: `REF-${order.orderCode}-${Date.now()}`,
            amount: deposit, // Positive amount, but context is refund
            payType: PAY_TYPE.FULL, // Reusing enum
            status: PAYMENT_STATUS.REFUNDED,
            transactionId: refundTransId,
            gatewayResponse: {
                refundedAt: new Date(),
                refundedBy: user._id,
                note: 'Equipment Deposit Refund'
            }
        }], { session });

        // Update order to note refund?
        order.staffNotes = (order.staffNotes || '') + `\n[System] Deposit refunded: ${deposit}`;
        await order.save({ session });

        await session.commitTransaction();
        logger.info(`Refunded deposit ${deposit} for equipment order ${orderId}`);
        return refundPayment[0];

    } catch (error) {
        await session.abortTransaction();
        logger.error('Refund deposit error', error);
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Create payment for equipment order (Full payment only)
 * @param {string} orderId - Order ID
 * @param {Object} user - Current user
 * @returns {Object} Payment with checkout URL
 */
export const createEquipmentPayment = async (orderId, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError('ID đơn hàng không hợp lệ');
    }

    const order = await EquipmentOrder.findById(orderId)
      .populate('equipmentId', 'name')
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
    if (order.status === EQUIPMENT_ORDER_STATUS.CANCELLED) {
      throw new ValidationError('Không thể thanh toán đơn hàng đã hủy');
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      throw new ValidationError('Đơn hàng đã được thanh toán');
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      targetId: orderId,
      targetModel: TARGET_MODEL.EQUIPMENT_ORDER,
      status: PAYMENT_STATUS.PENDING,
    }).session(session);

    if (existingPayment) {
      const now = new Date();
      const isExpired = existingPayment.expiresAt && new Date(existingPayment.expiresAt) < now;
      
      if (!isExpired) {
        await session.commitTransaction();
        return {
          payment: existingPayment,
          checkoutUrl: existingPayment.qrCodeUrl,
          message: 'Đã có link thanh toán cho đơn hàng này',
        };
      } else {
        // Cancel expired payment
        existingPayment.status = PAYMENT_STATUS.CANCELLED;
        existingPayment.gatewayResponse = {
          ...existingPayment.gatewayResponse,
          cancelledAt: new Date(),
          cancelReason: 'Payment link expired'
        };
        await existingPayment.save({ session });
      }
    }

    const paymentAmount = order.totalAmount;

    if (paymentAmount < 1000) {
      throw new ValidationError('Số tiền thanh toán tối thiểu là 1,000 VNĐ');
    }

    // Generate codes
    const payosOrderCode = generateOrderCode();
    const paymentCode = generatePaymentCode(orderId);

    // Create PayOS payment link
    let checkoutUrl = null;
    let qrCodeUrl = null;
    let gatewayResponse = {
      orderCode: payosOrderCode,
      createdAt: new Date(),
    };

    try {
      const { default: payos } = await import('../config/payos.js');
      const fullDescription = `Equipment: ${order.equipmentId?.name || 'Rental'} - ${order.orderCode}`;
      const safeDescription = truncate(fullDescription, PAYOS_DESCRIPTION_MAX);

      const paymentRequestData = {
        orderCode: payosOrderCode,
        amount: paymentAmount,
        description: safeDescription,
        items: [
          {
            name: truncate(order.equipmentId?.name || 'Equipment', 50),
            quantity: order.quantity,
            price: Math.floor(paymentAmount / order.quantity),
          },
        ],
        returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/equipment/payment/success?orderId=${orderId}`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/equipment/payment/cancel?orderId=${orderId}`,
        buyerName: order.customerId?.username || 'Customer',
        buyerEmail: order.customerId?.email || undefined,
      };

      logger.info('Creating PayOS payment link for equipment order', {
        orderCode: payosOrderCode,
        amount: paymentAmount,
      });

      let paymentLinkResponse;
      if (payos && typeof payos.createPaymentLink === 'function') {
        paymentLinkResponse = await payos.createPaymentLink(paymentRequestData);
      } else if (payos && typeof payos.paymentRequests?.create === 'function') {
        paymentLinkResponse = await payos.paymentRequests.create(paymentRequestData);
      } else {
        throw new Error('PayOS client not configured');
      }

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

    } catch (payosError) {
      logger.error('PayOS API Error for equipment:', {
        message: payosError.message,
        orderCode: payosOrderCode,
      });
      throw new Error(`Payment gateway error: ${payosError.message}`);
    }

    // Create payment record with expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const payment = new Payment({
      targetId: orderId,
      targetModel: TARGET_MODEL.EQUIPMENT_ORDER,
      category: PAYMENT_CATEGORY.EQUIPMENT,
      paymentCode,
      amount: paymentAmount,
      payType: PAY_TYPE.FULL,
      status: PAYMENT_STATUS.PENDING,
      transactionId: payosOrderCode.toString(),
      qrCodeUrl: checkoutUrl,
      gatewayResponse,
      expiresAt,
    });

    await payment.save({ session });

    await session.commitTransaction();

    logger.info('Equipment payment created', {
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
    logger.error('Create equipment payment error:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo thanh toán');
  } finally {
    session.endSession();
  }
};

/**
 * Handle Webhook (Delegated - logic moved to Payment Service)
 */
export const handleEquipmentPaymentWebhook = async (webhookPayload) => {
    const { handlePaymentWebhook } = await import('./payment.service.js');
    return await handlePaymentWebhook(webhookPayload);
};

/**
 * Get payment status
 */
export const getEquipmentPaymentStatus = async (paymentId) => {
    const { getPaymentStatus } = await import('./payment.service.js');
    return await getPaymentStatus(paymentId);
};

/**
 * Get order payments
 */
export const getEquipmentOrderPayments = async (orderId) => {
    try {
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            throw new ValidationError('ID đơn hàng không hợp lệ');
        }
        return await Payment.find({ targetId: orderId, targetModel: 'EquipmentOrder' }).sort({ createdAt: -1 });
    } catch (e) {
        if (e instanceof ValidationError) throw e;
        logger.error('Get equipment order payments error:', e);
        throw new Error('Lỗi lấy danh sách thanh toán');
    }
};

//#endregion

export default {
  createEquipmentOrder,
  getMyEquipmentOrders,
  getAllEquipmentOrders,
  getEquipmentOrderById,
  updateEquipmentOrderStatus,
  cancelEquipmentOrder,
  createEquipmentPayment,
  handleEquipmentPaymentWebhook,
  getEquipmentPaymentStatus,
  getEquipmentOrderPayments,
};
