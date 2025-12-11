//#region Imports
import asyncHandler from 'express-async-handler';
import {
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
} from '../services/setDesignOrder.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { isValidObjectId } from '../utils/validators.js';
//#endregion

//#region Order Controllers

/**
 * Create a new set design order
 * POST /api/set-design-orders
 */
export const createOrderController = asyncHandler(async (req, res) => {
  const orderData = req.body;
  const order = await createSetDesignOrder(orderData, req.user);

  res.status(201).json({
    success: true,
    message: 'Tạo đơn hàng thành công',
    data: order,
  });
});

/**
 * Get my orders (Customer)
 * GET /api/set-design-orders/my-orders
 */
export const getMyOrdersController = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    status: req.query.status,
  };

  const result = await getMySetDesignOrders(req.user, options);

  res.status(200).json({
    success: true,
    data: result.orders,
    pagination: result.pagination,
  });
});

/**
 * Get all orders (Staff/Admin)
 * GET /api/set-design-orders
 */
export const getAllOrdersController = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    status: req.query.status,
    customerId: req.query.customerId,
  };

  const result = await getAllSetDesignOrders(options);

  res.status(200).json({
    success: true,
    data: result.orders,
    pagination: result.pagination,
  });
});

/**
 * Get order by ID
 * GET /api/set-design-orders/:id
 */
export const getOrderByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !isValidObjectId(id)) {
    res.status(400);
    throw new Error('ID đơn hàng không hợp lệ');
  }

  const result = await getSetDesignOrderById(id, req.user);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Update order status (Staff/Admin)
 * PATCH /api/set-design-orders/:id/status
 */
export const updateOrderStatusController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!id || !isValidObjectId(id)) {
    res.status(400);
    throw new Error('ID đơn hàng không hợp lệ');
  }

  const order = await updateSetDesignOrderStatus(id, updateData, req.user);

  res.status(200).json({
    success: true,
    message: 'Cập nhật trạng thái đơn hàng thành công',
    data: order,
  });
});

/**
 * Cancel order (Customer)
 * POST /api/set-design-orders/:id/cancel
 */
export const cancelOrderController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!id || !isValidObjectId(id)) {
    res.status(400);
    throw new Error('ID đơn hàng không hợp lệ');
  }

  const order = await cancelSetDesignOrder(id, req.user, reason);

  res.status(200).json({
    success: true,
    message: 'Hủy đơn hàng thành công',
    data: order,
  });
});

//#endregion

//#region Payment Controllers

/**
 * Create payment for order
 * POST /api/set-design-orders/:id/payment
 */
export const createPaymentController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const paymentData = req.body;

  if (!id || !isValidObjectId(id)) {
    res.status(400);
    throw new Error('ID đơn hàng không hợp lệ');
  }

  const result = await createSetDesignPayment(id, paymentData, req.user);

  res.status(200).json({
    success: true,
    message: 'Tạo thanh toán thành công',
    data: result,
  });
});

/**
 * Handle payment webhook
 * POST /api/set-design-orders/payment/webhook
 */
export const paymentWebhookController = asyncHandler(async (req, res) => {
  try {
    const webhookPayload = { 
      body: req.body, 
      headers: req.headers,
      rawBody: req.rawBody 
    };
    
    logger.info('Received PayOS webhook', { 
      orderCode: req.body?.orderCode,
      hasSignature: !!(req.headers['x-payos-signature'] || req.headers['X-PayOS-Signature'])
    });

    await handleSetDesignPaymentWebhook(webhookPayload);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Set design payment webhook error:', error);
    
    // Return 200 even on error to prevent PayOS from retrying invalid signatures
    if (error.message === 'Invalid webhook signature') {
      return res.status(200).json({ success: false, message: 'Invalid signature' });
    }
    
    const msg = process.env.NODE_ENV === 'production' 
      ? 'Xử lý webhook thất bại' 
      : error.message || 'Xử lý webhook thất bại';
    res.status(500).json({ success: false, message: msg });
  }
});

/**
 * Get payment status
 * GET /api/set-design-orders/payment/:paymentId
 */
export const getPaymentStatusController = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  if (!paymentId || !isValidObjectId(paymentId)) {
    res.status(400);
    throw new Error('ID thanh toán không hợp lệ');
  }

  const payment = await getSetDesignPaymentStatus(paymentId);

  res.status(200).json({
    success: true,
    data: payment,
  });
});

/**
 * Get all payments for an order
 * GET /api/set-design-orders/:id/payments
 */
export const getOrderPaymentsController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !isValidObjectId(id)) {
    res.status(400);
    throw new Error('ID đơn hàng không hợp lệ');
  }

  const payments = await getSetDesignOrderPayments(id);

  res.status(200).json({
    success: true,
    data: payments,
  });
});

//#endregion

export default {
  createOrderController,
  getMyOrdersController,
  getAllOrdersController,
  getOrderByIdController,
  updateOrderStatusController,
  cancelOrderController,
  createPaymentController,
  paymentWebhookController,
  getPaymentStatusController,
  getOrderPaymentsController,
};
