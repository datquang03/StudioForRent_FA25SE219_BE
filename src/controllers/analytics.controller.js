// #region Imports
import { getDashboardStats } from '../services/analytics.service.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import logger from '../utils/logger.js';
// #endregion

// #region Analytics Controller

/**
 * GET /analytics/dashboard
 * Lấy thống kê dashboard cho admin
 */
export const getDashboardStatsController = asyncHandler(async (req, res) => {
  logger.info('Analytics dashboard requested by admin');

  const stats = await getDashboardStats();

  res.status(200).json({
    success: true,
    message: 'Dashboard statistics retrieved successfully',
    data: stats
  });
});

// #endregion