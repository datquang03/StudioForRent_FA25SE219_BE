import express from 'express';
import {
  createReportController,
  getReportsController,
  getMyReportsController,
  getReportByIdController,
  updateReportController,
  deleteReportController
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.use(sanitizeInput);
router.use(generalLimiter);
router.use(protect);

// Create report (Any authenticated user)
router.post('/', createReportController);

// List all reports (Staff/Admin only)
router.get('/', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getReportsController);

// List my reports (Authenticated User)
router.get('/my-reports', getMyReportsController);

// Get single report (Staff/Admin or Owner)
router.get('/:id', validateObjectId(), getReportByIdController);

// Update report (Staff/Admin only)
router.patch('/:id', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), validateObjectId(), updateReportController);

// Delete report (Admin only)
router.delete('/:id', authorize(USER_ROLES.ADMIN), validateObjectId(), deleteReportController);

export default router;
