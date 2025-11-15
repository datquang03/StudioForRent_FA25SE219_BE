// #region Imports
import express from 'express';
import { getDashboardStatsController } from '../controllers/analytics.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';
// #endregion

const router = express.Router();

// #region Analytics Routes

/**
 * @route GET /analytics/dashboard
 * @desc Get dashboard statistics (Admin only)
 * @access Private (Admin)
 */
router.get('/dashboard', protect, authorize(USER_ROLES.ADMIN), getDashboardStatsController);

// #endregion

export default router;