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
import { adminLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(adminLimiter);

router.use(protect);
router.use(authorize(USER_ROLES.ADMIN));

router.get('/customers', getCustomers);
router.get('/customers/:id', validateObjectId(), getCustomer);
router.patch('/customers/:id/ban', validateObjectId(), banCustomer);
router.patch('/customers/:id/unban', validateObjectId(), unbanCustomer);

router.get('/staff', getStaffList);
router.get('/staff/:id', validateObjectId(), getStaff);
router.patch('/staff/:id/deactivate', validateObjectId(), deactivateStaff);
router.patch('/staff/:id/activate', validateObjectId(), activateStaff);

export default router;
