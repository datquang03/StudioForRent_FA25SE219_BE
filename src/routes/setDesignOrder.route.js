//#region Imports
import express from 'express';
import {
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
} from '../controllers/setDesignOrder.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';
//#endregion

const router = express.Router();

//#region Middleware
router.use(sanitizeInput);
router.use(generalLimiter);
//#endregion

//#region Webhook (No Auth - Must be before protect middleware)
/**
 * POST /api/set-design-orders/payment/webhook
 * PayOS webhook handler for set design payments (no auth for webhooks)
 */
router.post('/payment/webhook', paymentWebhookController);
//#endregion

//#region Protected Routes
router.use(protect);

//#region Static Routes (Must be before dynamic :id routes)

/**
 * GET /api/set-design-orders/my-orders
 * Get my orders (Customer)
 */
router.get(
  '/my-orders',
  authorize(USER_ROLES.CUSTOMER),
  getMyOrdersController
);

/**
 * GET /api/set-design-orders/payment/:paymentId
 * Get payment status by payment ID
 */
router.get(
  '/payment/:paymentId',
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getPaymentStatusController
);

/**
 * GET /api/set-design-orders/all
 * Get all orders (Staff/Admin)
 */
router.get(
  '/all',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getAllOrdersController
);

//#endregion

//#region Order CRUD Routes

/**
 * POST /api/set-design-orders
 * Create a new order (Customer)
 */
router.post(
  '/',
  authorize(USER_ROLES.CUSTOMER),
  createOrderController
);

/**
 * GET /api/set-design-orders/:id
 * Get order by ID
 */
router.get(
  '/:id',
  validateObjectId(),
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getOrderByIdController
);

/**
 * PATCH /api/set-design-orders/:id/status
 * Update order status (Staff/Admin)
 */
router.patch(
  '/:id/status',
  validateObjectId(),
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  updateOrderStatusController
);

/**
 * POST /api/set-design-orders/:id/cancel
 * Cancel order (Customer - only pending orders)
 */
router.post(
  '/:id/cancel',
  validateObjectId(),
  authorize(USER_ROLES.CUSTOMER),
  cancelOrderController
);

//#endregion

//#region Payment Routes

/**
 * POST /api/set-design-orders/:id/payment
 * Create payment for order
 */
router.post(
  '/:id/payment',
  validateObjectId(),
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  createPaymentController
);

/**
 * GET /api/set-design-orders/:id/payments
 * Get all payments for an order
 */
router.get(
  '/:id/payments',
  validateObjectId(),
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getOrderPaymentsController
);

//#endregion

//#endregion

export default router;
