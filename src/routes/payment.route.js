//#region Imports
import express from 'express';
import { protect, authorize } from '../middlewares/auth.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import {
  createPaymentOptionsController,
  paymentWebhookController,
  getPaymentStatusController,
  createSinglePaymentController,
  getCustomerPaymentHistoryController,
  getStaffPaymentHistoryController,
  createRefundController,
  getRefundStatusController
} from '../controllers/payment.controller.js';
import { USER_ROLES } from '../utils/constants.js';
//#endregion

const router = express.Router();

//#region Payment Routes
/**
 * POST /api/payments/options/:bookingId
 * Create payment options (30%, 50%, 100%) for booking
 */
router.post(
  '/options/:bookingId',
  generalLimiter,
  protect,
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  createPaymentOptionsController
);

/**
 * POST /api/payments/create/:bookingId
 * Create a single payment for chosen option (body: { percentage: 30|50|100 } or { payType })
 */
router.post(
  '/create/:bookingId',
  generalLimiter,
  protect,
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  createSinglePaymentController
);

/**
 * POST /api/payments/remaining/:bookingId
 * Create payment for remaining amount after deposit
 */
router.post(
  '/remaining/:bookingId',
  generalLimiter,
  protect,
  // Create payment for remaining amount
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  async (req, res, next) => {
    // delegate to controller
    const { createRemainingPaymentController } = await import('../controllers/payment.controller.js');
    return createRemainingPaymentController(req, res, next);
  }
);

/**
 * POST /api/payments/webhook
 * PayOS webhook handler (no auth for webhooks)
 */
router.post(
  '/webhook',
  paymentWebhookController
);

/**
 * GET /api/payments/history
 * Get payment history for customer
 */
router.get(
  '/history',
  generalLimiter,
  protect,
  authorize(USER_ROLES.CUSTOMER),
  getCustomerPaymentHistoryController
);

/**
 * GET /api/payments/staff/history
 * Get payment history for staff/admin (can filter by studio)
 */
router.get(
  '/staff/history',
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getStaffPaymentHistoryController
);

/**
 * GET /api/payments/:paymentId
 * Get payment status
 */
router.get(
  '/:paymentId',
  generalLimiter,
  protect,
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getPaymentStatusController
);

/**
 * POST /api/payments/:paymentId/refund
 * Create refund request
 */
router.post(
  '/:paymentId/refund',
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  createRefundController
);

/**
 * GET /api/payments/:paymentId/refund
 * Get refund status
 */
router.get(
  '/:paymentId/refund',
  generalLimiter,
  protect,
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getRefundStatusController
);
//#endregion

export default router;