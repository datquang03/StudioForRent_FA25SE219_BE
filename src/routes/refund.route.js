import express from 'express';
import { protect, authorize } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { ALLOWED_FILE_TYPES, FILE_SIZE_LIMITS } from '../config/upload.config.js';
import { USER_ROLES } from '../utils/constants.js';
import {
  approveRefundController,
  rejectRefundController,
  getPendingRefundsController,
  getApprovedRefundsController,
  confirmManualRefundController,
  getRefundDetailController,
  getMyRefundsController,
  getAllRefundsController
} from '../controllers/refund.controller.js';

const router = express.Router();

/**
 * @route   GET /api/refunds
 * @desc    Get all refunds with filters (Staff/Admin only)
 * @access  Staff, Admin
 * @query   status, bookingId, userId, startDate, endDate, minAmount, maxAmount, page, limit
 */
router.get(
  '/',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getAllRefundsController
);

/**
 * @route   GET /api/refunds/my-requests
 * @desc    Get my refund requests (Customer)
 * @access  Customer (authenticated)
 */
router.get(
  '/my-requests',
  protect,
  getMyRefundsController
);

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
 * @route   GET /api/refunds/approved
 * @desc    Get all approved refunds waiting for manual transfer (Staff/Admin only)
 * @access  Staff, Admin
 */
router.get(
  '/approved',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  getApprovedRefundsController
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
 * @route   POST /api/refunds/:refundId/confirm
 * @desc    Confirm manual refund transfer completed (Staff/Admin only)
 * @access  Staff, Admin
 * @body    transactionRef (optional), note (optional)
 * @file    proofImage (optional) - JPEG/PNG, max 5MB
 */
router.post(
  '/:refundId/confirm',
  protect,
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.single('proofImage', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.IMAGE),
  confirmManualRefundController
);

export default router;
