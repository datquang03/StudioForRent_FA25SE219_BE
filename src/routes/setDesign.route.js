// #region Imports
import express from 'express';
import {
  getSetDesignsController,
  getSetDesignByIdController,
  createSetDesignController,
  updateSetDesignController,
  deleteSetDesignController,
  uploadDesignImagesController,
  getSetDesignsByCategoryController,
  getActiveSetDesignsController,
  createCustomDesignRequestController,
  getCustomDesignRequestsController,
  getCustomDesignRequestByIdController,
  updateCustomDesignRequestStatusController,
  deleteCustomDesignRequestController,
  convertRequestToSetDesignController,
  generateImageFromTextController,
  chatWithDesignAIController,
  generateCompleteDesignController,
  getCustomSetDesignController,
} from '../controllers/setDesign.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter, aiLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';
// #endregion

const router = express.Router();

// #region Set Design Routes - Product Catalog

// Apply middleware to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

// Custom design requests management (Staff/Admin) - Moved here to avoid conflict with /:id
router.get('/custom-requests', protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getCustomDesignRequestsController);
router.get('/custom-requests/:id', protect, validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getCustomDesignRequestByIdController);
router.patch('/custom-requests/:id/status', protect, validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateCustomDesignRequestStatusController);
router.delete('/custom-requests/:id', protect, validateObjectId(), deleteCustomDesignRequestController);

// Public routes (no authentication required)
router.get('/active', getActiveSetDesignsController);
router.get('/category/:category', getSetDesignsByCategoryController);
router.get('/custom-request', protect, getCustomSetDesignController);
router.get('/', getSetDesignsController);
router.get('/:id', validateObjectId(), getSetDesignByIdController);

// Custom design request - Public route for customers to submit requests
router.post('/custom-request', aiLimiter, createCustomDesignRequestController);

// AI Image Generation from Text using Gemini Imagen 3 - Public route with rate limiting
router.post('/generate-from-text', aiLimiter, generateImageFromTextController);

// AI Design Consultation Chat - Public route with rate limiting
router.post('/ai-chat', aiLimiter, chatWithDesignAIController);

// AI Complete Design Generation (Chat → Summary → Image) - Public route with rate limiting
router.post('/ai-generate-design', aiLimiter, generateCompleteDesignController);

// Protected routes (authentication required)
router.use(protect);

// Image upload (Customer and Staff)
router.post('/upload-images', authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), uploadLimiter, uploadDesignImagesController);

// Admin-only routes
// Staff-only routes
router.post('/', authorize(USER_ROLES.STAFF), createSetDesignController);
router.put('/:id', validateObjectId(), authorize(USER_ROLES.STAFF), updateSetDesignController);
router.delete('/:id', validateObjectId(), authorize(USER_ROLES.STAFF), deleteSetDesignController);
router.post('/custom-requests/:id/convert', validateObjectId(), authorize(USER_ROLES.STAFF), convertRequestToSetDesignController);

// #endregion

export default router;