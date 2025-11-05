import express from 'express';
import {
  getServiceList,
  getAvailableServiceList,
  getServiceDetail,
  createServiceController,
  updateServiceController,
  deleteServiceController,
} from '../controllers/service.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { validateServiceCreation, validateServiceUpdate } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

// Global middlewares
router.use(sanitizeInput);
router.use(generalLimiter);

// Public routes
router.get('/available', getAvailableServiceList);

// Protected routes (Staff & Admin only)
router.use(protect);
router.use(authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

// Collection routes
router.route('/')
  .get(getServiceList)
  .post(validateServiceCreation, createServiceController);

// Resource routes
router.route('/:id')
  .get(validateObjectId(), getServiceDetail)
  .patch(validateObjectId(), validateServiceUpdate, updateServiceController)
  .delete(validateObjectId(), deleteServiceController);

export default router;
