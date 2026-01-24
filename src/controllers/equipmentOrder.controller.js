import {
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
  refundEquipmentDeposit,
} from '../services/equipmentOrder.service.js';
import { createRefundRequestForTarget } from '../services/refund.service.js';
import { TARGET_MODEL } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * Create equipment order
 * POST /api/equipment-orders
 */
export const createOrder = async (req, res, next) => {
  try {
    const order = await createEquipmentOrder(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Đơn thuê thiết bị đã được tạo',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my equipment orders
 * GET /api/equipment-orders/my-orders
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await getMyEquipmentOrders(req.user, { page, limit, status });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all equipment orders (Staff/Admin)
 * GET /api/equipment-orders/all
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const { page, limit, status, customerId } = req.query;
    const result = await getAllEquipmentOrders({ page, limit, status, customerId });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get equipment order by ID
 * GET /api/equipment-orders/:id
 */
export const getOrderById = async (req, res, next) => {
  try {
    const result = await getEquipmentOrderById(req.params.id, req.user);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (Staff/Admin)
 * PATCH /api/equipment-orders/:id/status
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await updateEquipmentOrderStatus(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'Cập nhật trạng thái đơn thuê thành công',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel order (Customer)
 * POST /api/equipment-orders/:id/cancel
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await cancelEquipmentOrder(req.params.id, req.user, reason);
    res.json({
      success: true,
      message: 'Đơn thuê đã được hủy',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create payment for equipment order (Full payment only)
 * POST /api/equipment-orders/:id/payment
 */
export const createPayment = async (req, res, next) => {
  try {
    const result = await createEquipmentPayment(req.params.id, req.user);
    res.status(201).json({
      success: true,
      message: 'Link thanh toán đã được tạo',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle PayOS webhook for equipment payment
 * POST /api/equipment-orders/payment/webhook
 */
export const handlePaymentWebhook = async (req, res, next) => {
  try {
    logger.info('Equipment payment webhook received', { body: req.body });

    const webhookPayload = {
      body: req.body,
      headers: req.headers,
    };

    const result = await handleEquipmentPaymentWebhook(webhookPayload);

    res.json({ success: true });
  } catch (error) {
    logger.error('Equipment webhook handler error:', error);
    res.json({ success: true });
  }
};

/**
 * Get payment status
 * GET /api/equipment-orders/payment/:paymentId
 */
export const getPaymentStatus = async (req, res, next) => {
  try {
    const payment = await getEquipmentPaymentStatus(req.params.paymentId);
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order payments
 * GET /api/equipment-orders/:id/payments
 */
export const getOrderPayments = async (req, res, next) => {
  try {
    const payments = await getEquipmentOrderPayments(req.params.id);
    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refund deposit
 * POST /api/equipment-orders/:id/refund-deposit
 */
export const refundDeposit = async (req, res, next) => {
  try {
    const result = await refundEquipmentDeposit(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Hoàn tiền cọc thành công',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create refund request for cancelled equipment order
 * POST /api/equipment-orders/:id/refund-request
 */
export const createRefundRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bankName, accountNumber, accountName, reason, proofImageUrls } = req.body;

    const refund = await createRefundRequestForTarget(
      id, 
      TARGET_MODEL.EQUIPMENT_ORDER,
      {
        bankName,
        accountNumber,
        accountName,
        reason,
        proofImageUrls,
        userId: req.user._id
      }
    );

    res.status(201).json({
      success: true,
      message: 'Yêu cầu hoàn tiền đã được tạo thành công',
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  createPayment,
  handlePaymentWebhook,
  getPaymentStatus,
  getOrderPayments,
  refundDeposit,
  createRefundRequest,
};
