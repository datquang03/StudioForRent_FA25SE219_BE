import express from 'express';
import {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
} from '../controllers/schedule.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

// Sanitize and rate limit all schedule endpoints
router.use(sanitizeInput);
router.use(generalLimiter);

// Public listing
router.get('/', getSchedules);
router.get('/:id', validateObjectId(), getSchedule);

// Protected admin/staff routes for management
router.use(protect);
router.use(adminLimiter);
router.use(authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

router.post('/', createSchedule);
router.patch('/:id', validateObjectId(), updateSchedule);
router.delete('/:id', validateObjectId(), deleteSchedule);

export default router;
