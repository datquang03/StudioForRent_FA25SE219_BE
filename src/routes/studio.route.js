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
} from '../controllers/studio.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
import { validateStudioCreation, validateStudioUpdate, validateObjectId, sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(generalLimiter);

router.get('/active', getActiveStudiosController);
router.get('/:id', validateObjectId(), getStudio);

router.use(protect);
router.use(authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

router.get('/', getStudios);
router.post('/', validateStudioCreation, createStudioController);
router.patch('/:id', validateObjectId(), validateStudioUpdate, updateStudioController);
router.patch('/:id/activate', validateObjectId(), activateStudio);
router.patch('/:id/deactivate', validateObjectId(), deactivateStudio);
router.patch('/:id/maintenance', validateObjectId(), setMaintenanceStudio);
router.delete('/:id', validateObjectId(), deleteStudioController);

export default router;
