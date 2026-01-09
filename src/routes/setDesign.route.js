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
  updateCustomDesignRequestController,
  updateCustomDesignRequestStatusController,
  deleteCustomDesignRequestController,
  convertRequestToSetDesignController,
  generateImageFromTextController,
  chatWithDesignAIController,
  generateCompleteDesignController,
  getCustomSetDesignController,
  getConvertedCustomDesignsController,
  getConvertedCustomDesignByIdController,
  updateConvertedCustomDesignController,
  deleteConvertedCustomDesignController,
  getAllConvertedSetDesignsController,
} from '../controllers/setDesign.controller.js';
import { protect, optionalProtect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter, aiLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';
import { upload, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES } from '../middlewares/upload.js';
import { USER_ROLES } from '../utils/constants.js';
// #endregion

const router = express.Router();

// #region Set Design Routes - Product Catalog

// Apply middleware to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

// Custom design requests management (Staff/Admin) - Moved here to avoid conflict with /:id
router.get('/custom-requests', protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getCustomDesignRequestsController);
router.get('/custom-requests/:id', protect, validateObjectId(), authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), getCustomDesignRequestByIdController);
router.put('/custom-requests/:id', 
  protect, 
  validateObjectId(), 
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.array('referenceImages', 5, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.SET_DESIGN_IMAGE),
  updateCustomDesignRequestController
);
router.patch('/custom-requests/:id/status', protect, validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateCustomDesignRequestStatusController);
router.delete('/custom-requests/:id', protect, validateObjectId(), authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), deleteCustomDesignRequestController);

// Public routes (no authentication required)
router.get('/active', getActiveSetDesignsController);
router.get('/category/:category', getSetDesignsByCategoryController);
router.get('/custom-request', protect, getCustomSetDesignController);
router.get('/converted', getAllConvertedSetDesignsController);
router.get('/', getSetDesignsController);

// Converted custom designs - Public GET endpoints
router.get('/converted-custom-designs', getConvertedCustomDesignsController);
router.get('/converted-custom-designs/:id', validateObjectId(), getConvertedCustomDesignByIdController);

// Get Set Design by ID
router.get('/:id', validateObjectId(), getSetDesignByIdController);

// Custom design request - Protected route (authentication required - Customer only)
router.post('/custom-request', 
  protect, 
  authorize(USER_ROLES.CUSTOMER),
  aiLimiter, 
  upload.array('referenceImages', 5, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.SET_DESIGN_IMAGE),
  createCustomDesignRequestController
);

// AI Image Generation from Text using Gemini Imagen 3 - Public route with rate limiting
router.post('/generate-from-text', aiLimiter, generateImageFromTextController);

// AI Design Consultation Chat - Public route with rate limiting
router.post('/ai-chat', aiLimiter, chatWithDesignAIController);

// AI Complete Design Generation (Chat → Summary → Image) - Public route with rate limiting
router.post('/ai-generate-design', aiLimiter, generateCompleteDesignController);

// Protected routes (authentication required)
router.use(protect);

// Image upload form-data (Customer and Staff)
router.post('/upload-images', 
  authorize(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN), 
  uploadLimiter, 
  upload.array('images', 10, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.SET_DESIGN_IMAGE),
  uploadDesignImagesController
);

// Staff-only routes
router.post('/', authorize(USER_ROLES.STAFF), createSetDesignController);
router.put('/:id', validateObjectId(), authorize(USER_ROLES.STAFF), updateSetDesignController);
router.delete('/:id', validateObjectId(), authorize(USER_ROLES.STAFF), deleteSetDesignController);
router.post('/custom-requests/:id/convert', validateObjectId(), authorize(USER_ROLES.STAFF), convertRequestToSetDesignController);

// Converted custom designs - Protected PUT/DELETE (Staff/Admin only)
router.put('/converted-custom-designs/:id', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateConvertedCustomDesignController);
router.delete('/converted-custom-designs/:id', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), deleteConvertedCustomDesignController);

// #endregion

export default router;