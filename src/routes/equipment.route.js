import express from 'express';
import {
  getEquipmentList,
  getAvailableEquipmentList,
  getEquipmentDetail,
  createEquipmentController,
  updateEquipmentController,
  deleteEquipmentController,
  setMaintenanceQuantityController,
  importEquipmentController,
} from '../controllers/equipment.controller.js';
import multer from 'multer';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateEquipmentCreation, validateEquipmentUpdate, validateMaintenanceQuantity, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// multer memory storage for small uploads (xlsx)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Global middlewares
router.use(sanitizeInput);
router.use(generalLimiter);

// ==================== PUBLIC ROUTES ====================
router.get('/available', getAvailableEquipmentList);

// ==================== PROTECTED ROUTES ====================
router.use(protect);
router.use(authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

// Collection routes
router.route('/')
  .get(getEquipmentList)
  .post(validateEquipmentCreation, createEquipmentController);

// Import route - staff/admin only
router.post('/import', upload.single('file'), importEquipmentController);

// Specific actions (must be before /:id)
router.patch('/:id/set-maintenance-quantity', 
  validateObjectId(), 
  validateMaintenanceQuantity, 
  setMaintenanceQuantityController
);

// Resource routes
router.route('/:id')
  .get(validateObjectId(), getEquipmentDetail)
  .patch(validateObjectId(), validateEquipmentUpdate, updateEquipmentController)
  .delete(validateObjectId(), deleteEquipmentController);

export default router;
