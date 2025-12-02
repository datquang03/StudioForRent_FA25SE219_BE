import express from 'express';
import {
  getStudios,
  getActiveStudiosController,
  getStudio,
  createStudioController,
  updateStudioController,
  activateStudio,
  deactivateStudio,
  setMaintenanceStudio,
  deleteStudioController,
  uploadStudioMedia,
  getStudioScheduleController,
  getStudioScheduleByDateController,
  getStudiosScheduleController,
  getStudiosScheduleByDateController,
  getStudiosAvailabilityController,
  getStudioBookedHistoryController,
  getStudiosBookedSchedulesController,
  getStudioAvailabilityController,
} from '../controllers/studio.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateStudioCreation, validateStudioUpdate, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter, searchLimiter } from '../middlewares/rateLimiter.js';
import { upload, handleMulterError, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES } from '../middlewares/upload.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

// Public schedule routes (no auth required)
router.get('/schedule', searchLimiter, getStudiosScheduleController);
router.get('/schedule/date/:date', searchLimiter, getStudiosScheduleByDateController);
router.get('/:id/schedule', validateObjectId(), searchLimiter, getStudioScheduleController);
router.get('/:id/schedule/date/:date', validateObjectId(), searchLimiter, getStudioScheduleByDateController);

// Public availability routes (no auth required)
router.get('/availability', searchLimiter, getStudiosAvailabilityController);
router.get('/:id/availability', validateObjectId(), searchLimiter, getStudioAvailabilityController);

// Protected booked history routes (require auth)
router.get('/booked-schedules', protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), searchLimiter, getStudiosBookedSchedulesController);
router.get('/:id/booked-history', validateObjectId(), protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), searchLimiter, getStudioBookedHistoryController);

// Search routes with stricter rate limiting
router.get('/active', searchLimiter, getActiveStudiosController);
router.get('/:id', validateObjectId(), getStudio);

router.use(protect);
router.use(authorize(USER_ROLES.STAFF));

router.get('/', searchLimiter, getStudios);
router.post('/', validateStudioCreation, createStudioController);
router.patch('/:id', validateObjectId(), validateStudioUpdate, updateStudioController);
router.patch('/:id/activate', validateObjectId(), activateStudio);
router.patch('/:id/deactivate', validateObjectId(), deactivateStudio);
router.patch('/:id/maintenance', validateObjectId(), setMaintenanceStudio);
router.delete('/:id', validateObjectId(), deleteStudioController);

// Upload studio media route
router.post('/:id/media',
  validateObjectId(),
  upload.fields([
    {
      name: 'images',
      maxCount: 10,
      allowedTypes: ALLOWED_FILE_TYPES.IMAGES,
      maxSize: FILE_SIZE_LIMITS.STUDIO_IMAGE
    },
    {
      name: 'video',
      maxCount: 1,
      allowedTypes: ALLOWED_FILE_TYPES.VIDEOS,
      maxSize: FILE_SIZE_LIMITS.STUDIO_VIDEO
    }
  ]),
  handleMulterError,
  uploadStudioMedia
);

export default router;
