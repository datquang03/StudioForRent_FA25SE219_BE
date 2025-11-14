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
} from '../controllers/equipment.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateEquipmentCreation, validateEquipmentUpdate, validateMaintenanceQuantity, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { upload, handleMulterError, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES } from '../middlewares/upload.js';

const router = express.Router();

// Global middlewares
router.use(sanitizeInput);
router.use(generalLimiter);

// PUBLIC ROUTES
router.get('/available', getAvailableEquipmentList);
router.get('/available/:id', validateObjectId(), getAvailableEquipmentDetailController);

// PROTECTED ROUTES
router.use(protect);
router.use(authorize(USER_ROLES.STAFF));

// Collection routes
router.route('/')
  .get(getEquipmentList)
  .post(validateEquipmentCreation, createEquipmentController);

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

// Resource routes
router.route('/:id')
  .get(validateObjectId(), getEquipmentDetail)
  .patch(validateObjectId(), validateEquipmentUpdate, updateEquipmentController)
  .delete(validateObjectId(), deleteEquipmentController);

export default router;
