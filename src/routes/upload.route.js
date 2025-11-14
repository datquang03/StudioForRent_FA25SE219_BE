import express from 'express';
import {
  uploadAvatarController,
  uploadImageController,
  uploadVideoController,
  uploadMultipleImagesController,
  uploadStudioMediaController,
  uploadEquipmentImageController,
  uploadReviewImagesController,
  uploadSetDesignImagesController,
  deleteImageController,
  getOptimizedImageController
} from '../controllers/upload.controller.js';
import { upload, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES, handleMulterError } from '../middlewares/upload.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply rate limiter to all routes
router.use(generalLimiter);

// Apply authentication to all routes
router.use(protect);

// User avatar upload (Staff & Customer)
router.post('/avatar',
  authorize(USER_ROLES.STAFF, USER_ROLES.CUSTOMER),
  upload.single('avatar', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.AVATAR),
  uploadAvatarController
);

// Generic single image upload (Staff & Admin only)
router.post('/image',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.single('image', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.STUDIO_IMAGE),
  uploadImageController
);

// Video upload (Staff & Admin only)
router.post('/video',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.single('video', ALLOWED_FILE_TYPES.VIDEOS, FILE_SIZE_LIMITS.STUDIO_VIDEO),
  uploadVideoController
);

// Multiple images upload (Staff & Admin only)
router.post('/images',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.array('images', 10, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.STUDIO_IMAGE),
  uploadMultipleImagesController
);

// Studio media upload (images + video) - Staff & Admin only
router.post('/studio-media',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.fields([
    { name: 'images', maxCount: 10, allowedTypes: ALLOWED_FILE_TYPES.IMAGES, maxSize: FILE_SIZE_LIMITS.STUDIO_IMAGE },
    { name: 'video', maxCount: 1, allowedTypes: ALLOWED_FILE_TYPES.VIDEOS, maxSize: FILE_SIZE_LIMITS.STUDIO_VIDEO }
  ]),
  uploadStudioMediaController
);

// Equipment image upload - Staff & Admin only
router.post('/equipment/:equipmentId/image',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.single('image', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.EQUIPMENT_IMAGE),
  uploadEquipmentImageController
);

// Review images upload - Customer only (for their own reviews)
router.post('/review/:reviewId/images',
  authorize(USER_ROLES.CUSTOMER),
  upload.array('images', 5, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.REVIEW_IMAGE),
  uploadReviewImagesController
);

// Set design images upload - Staff & Admin only
router.post('/set-design/:setDesignId/images',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  upload.array('images', 10, ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.SET_DESIGN_IMAGE),
  uploadSetDesignImagesController
);

// Delete file - Staff & Admin only
router.delete('/file/:publicId',
  authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
  deleteImageController
);

// Get optimized image URL - Public access (no auth required for viewing)
router.get('/optimized-image/:publicId',
  getOptimizedImageController
);

// Error handler for multer errors
router.use(handleMulterError);

export default router;