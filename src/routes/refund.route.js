import express from 'express';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import {
  createRefundRequestController,
  approveRefundController,
  rejectRefundController,
  getPendingRefundsController,
  getRefundDetailController,
  getRefundsForBookingController,
  retryRefundController
} from '../controllers/refund.controller.js';

const router = express.Router();

/**
 * @route   GET /api/refunds/pending
 * @desc    Get all pending refund requests (Staff/Admin only)
 * @access  Staff, Admin
 */
router.get(
  '/pending',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getPendingRefundsController
);

/**
 * @route   GET /api/refunds/:refundId
 * @desc    Get refund details
 * @access  Customer (own), Staff, Admin
 */
router.get(
  '/:refundId',
  protect,
  getRefundDetailController
);

/**
 * @route   POST /api/refunds/:refundId/approve
 * @desc    Approve a pending refund request (Staff/Admin only)
 * @access  Staff, Admin
 */
router.post(
  '/:refundId/approve',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  approveRefundController
);

/**
 * @route   POST /api/refunds/:refundId/reject
 * @desc    Reject a pending refund request (Staff/Admin only)
 * @access  Staff, Admin
 */
router.post(
  '/:refundId/reject',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  rejectRefundController
);

/**
 * @route   POST /api/refunds/:refundId/retry
 * @desc    Retry a failed refund (Staff/Admin only)
 * @access  Staff, Admin
 */
router.post(
  '/:refundId/retry',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  retryRefundController
);

export default router;
