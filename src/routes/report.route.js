import express from 'express';
import {
  createReportController,
  getReportsController,
  getReportByIdController,
  updateReportController,
  deleteReportController
} from '../controllers/report.controller.js';
import { protect } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.use(sanitizeInput);
router.use(generalLimiter);

// Public create (or add protect if needed)
router.post('/', protect, createReportController);

// List all reports (admin/staff only in real app)
router.get('/', protect, getReportsController);

// Get single report
router.get('/:id', protect, validateObjectId(), getReportByIdController);

// Update report
router.patch('/:id', protect, validateObjectId(), updateReportController);

// Delete report
router.delete('/:id', protect, validateObjectId(), deleteReportController);

export default router;
