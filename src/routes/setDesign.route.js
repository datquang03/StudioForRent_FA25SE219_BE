// #region Imports
import express from 'express';
import {
  generateAiDesignController,
  getAiIterationsController,
  selectFinalDesignController,
  generatePropsRecommendationsController,
  getSetDesignController,
  updateSetDesignStatusController,
  getSetDesignByBookingController,
  chatWithAiController,
  getChatHistoryController,
  generateFromChatController
} from '../controllers/setDesign.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter, aiLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';
// #endregion

const router = express.Router();

// #region Set Design Routes

// Apply middleware to all routes
router.use(sanitizeInput);
router.use(generalLimiter);
router.use(protect);

// Chat-based design workflow (NEW - Customer only)
router.post('/chat/:bookingId', aiLimiter, authorize(USER_ROLES.CUSTOMER), chatWithAiController);
router.get('/:bookingId/chat-history', authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), getChatHistoryController);
router.post('/generate-from-chat/:bookingId', aiLimiter, authorize(USER_ROLES.CUSTOMER), generateFromChatController);

// Customer routes (Legacy one-shot approach - still supported)
router.post('/generate/:bookingId', aiLimiter, authorize(USER_ROLES.CUSTOMER), generateAiDesignController);
router.get('/booking/:bookingId', authorize(USER_ROLES.CUSTOMER), getSetDesignByBookingController);

// Customer-only routes (AI generation and modification)
router.post('/:setDesignId/select', validateObjectId(), authorize(USER_ROLES.CUSTOMER), selectFinalDesignController);
router.post('/:setDesignId/props', validateObjectId(), authorize(USER_ROLES.CUSTOMER), generatePropsRecommendationsController);

// Shared view routes (customers and staff can view)
router.get('/:setDesignId', validateObjectId(), authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), getSetDesignController);
router.get('/:setDesignId/iterations', validateObjectId(), authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), getAiIterationsController);

// Staff-only routes
router.patch('/:setDesignId/status', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateSetDesignStatusController);

// #endregion

export default router;