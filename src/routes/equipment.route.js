import express from 'express';
import {
  getEquipmentList,
  getAvailableEquipmentList,
  getEquipmentDetail,
  getAvailableEquipmentDetailController,
  createEquipmentController,
  updateEquipmentController,
  deleteEquipmentController,
  setMaintenanceQuantityController,
  uploadEquipmentImage,
  resetEquipmentQuantitiesController,
} from '../controllers/equipment.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateEquipmentCreation, validateEquipmentUpdate, validateMaintenanceQuantity, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter, searchLimiter } from '../middlewares/rateLimiter.js';
import { upload, handleMulterError, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES } from '../middlewares/upload.js';

const router = express.Router();

// Global middlewares
router.use(sanitizeInput);
router.use(generalLimiter);

// PUBLIC ROUTES
router.get('/', searchLimiter, getEquipmentList);
router.get('/available', searchLimiter, getAvailableEquipmentList);
router.get('/available/:id', validateObjectId(), getAvailableEquipmentDetailController);
router.get('/:id', validateObjectId(), getEquipmentDetail);

// PROTECTED ROUTES (Staff only for modifications)
router.use(protect);
router.use(authorize(USER_ROLES.STAFF));

// Collection routes (create only)
router.post('/', validateEquipmentCreation, createEquipmentController);

// Specific actions (must be before /:id)
router.patch('/:id/set-maintenance-quantity',
  validateObjectId(),
  validateMaintenanceQuantity,
  setMaintenanceQuantityController
);

// Upload equipment image route
router.post('/:id/image',
  validateObjectId(),
  upload.single('image', ALLOWED_FILE_TYPES.IMAGES, FILE_SIZE_LIMITS.EQUIPMENT_IMAGE),
  handleMulterError,
  uploadEquipmentImage
);

// Resource routes (update and delete only)
router.patch('/:id', validateObjectId(), validateEquipmentUpdate, updateEquipmentController);
router.delete('/:id', validateObjectId(), deleteEquipmentController);

// Reset quantities (DEV/TESTING ONLY - disabled in production)
if (process.env.NODE_ENV !== 'production') {
  router.post('/:id/reset-quantities', validateObjectId(), resetEquipmentQuantitiesController);
}

export default router;

