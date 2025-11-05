import express from 'express';
import {
  getEquipmentList,
  getAvailableEquipmentList,
  getEquipmentDetail,
  createEquipmentController,
  updateEquipmentController,
  deleteEquipmentController,
  setMaintenanceQuantityController,
} from '../controllers/equipment.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateEquipmentCreation, validateEquipmentUpdate, validateMaintenanceQuantity, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

// Public routes - Customer có thể xem equipment available khi booking
// IMPORTANT: Specific routes (/available) MUST come BEFORE dynamic routes (/:id)
router.get('/available', getAvailableEquipmentList);

// Protected routes - Chỉ staff và admin
router.use(protect);
router.use(authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

// CRUD operations
router.get('/', getEquipmentList);
router.get('/:id', validateObjectId(), getEquipmentDetail);
router.post('/', validateEquipmentCreation, createEquipmentController);
router.patch('/:id', validateObjectId(), validateEquipmentUpdate, updateEquipmentController);
router.delete('/:id', validateObjectId(), deleteEquipmentController);

// Quantity management (specific route before /:id)
router.patch('/:id/set-maintenance-quantity', validateObjectId(), validateMaintenanceQuantity, setMaintenanceQuantityController);

export default router;
