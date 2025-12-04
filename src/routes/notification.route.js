// #region Imports
import express from 'express';
import {
  getNotificationsController,
  markAsReadController,
  deleteNotificationController,
  deleteAllReadNotificationsController,
  sendManualNotificationController,
} from '../controllers/notification.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';
// #endregion

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

// All routes require authentication
router.use(protect);

// Get notifications (for customer, staff, admin)
router.get(
  '/',
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN]),
  getNotificationsController
);

// Mark as read (for customer, staff, admin)
router.put(
  '/:id/read',
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN]),
  markAsReadController
);

// Delete all read notifications (for customer, staff, admin)
router.delete(
  '/read/all',
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN]),
  deleteAllReadNotificationsController
);

// Delete notification (for customer, staff, admin)
router.delete(
  '/:id',
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN]),
  deleteNotificationController
);

// Send manual notification (for staff, admin only)
router.post(
  '/',
  authorize([USER_ROLES.STAFF, USER_ROLES.ADMIN]),
  sendManualNotificationController
);

export default router;