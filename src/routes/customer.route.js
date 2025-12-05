import express from 'express';
import {
  getProfile,
  updateProfile,
  deleteAccount,
  uploadAvatar,
} from '../controllers/customer.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';
import { upload, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES, handleMulterError } from '../middlewares/upload.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

router.use(protect);
router.use(authorize(USER_ROLES.CUSTOMER));

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.post('/avatar', upload.single('avatar', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.AVATAR), uploadAvatar);
router.delete('/profile', deleteAccount);

router.use(handleMulterError);

export default router;
