import express from 'express';
import {
  getCustomers,
  getCustomer,
  banCustomer,
  unbanCustomer,
  getStaffList,
  getStaff,
  deactivateStaff,
  activateStaff,
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { adminLimiter, searchLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(adminLimiter);

router.use(protect);

// Customer Management - Accessible by Staff and Admin
router.get('/customers', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), searchLimiter, getCustomers);
router.get('/customers/:id', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), validateObjectId(), getCustomer);
router.patch('/customers/:id/ban', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), validateObjectId(), banCustomer);
router.patch('/customers/:id/unban', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), validateObjectId(), unbanCustomer);

// Staff Management - Accessible by Admin only
router.get('/staff', authorize(USER_ROLES.ADMIN), searchLimiter, getStaffList);
router.get('/staff/:id', authorize(USER_ROLES.ADMIN), validateObjectId(), getStaff);
router.patch('/staff/:id/deactivate', authorize(USER_ROLES.ADMIN), validateObjectId(), deactivateStaff);
router.patch('/staff/:id/activate', authorize(USER_ROLES.ADMIN), validateObjectId(), activateStaff);

export default router;
