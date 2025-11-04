import express from 'express';
import {
  getProfile,
  updateProfile,
  deleteAccount,
} from '../controllers/customer.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

router.use(protect);
router.use(authorize(USER_ROLES.CUSTOMER));

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.delete('/profile', deleteAccount);

export default router;
