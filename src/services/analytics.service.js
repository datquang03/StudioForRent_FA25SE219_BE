// #region Imports
import { User, Studio, Equipment, Promotion, Notification, Booking, Payment } from '../models/index.js';
import logger from '../utils/logger.js';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../utils/constants.js';
// #endregion

// #region Analytics Service

/**
 * Lấy thống kê users
 * @returns {Object} User statistics
 */
export const getUserStats = async () => {
  try {
    const [
      totalUsers,
      activeUsers,
      customers,
      activeCustomers,
      staff,
      activeStaff,
      admins,
      activeAdmins,
      verifiedUsers,
      recentUsers // Users created in last 30 days
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: 'staff' }),
      User.countDocuments({ role: 'staff', isActive: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'admin', isActive: true }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: {
        customers: { total: customers, active: activeCustomers, inactive: customers - activeCustomers },
        staff: { total: staff, active: activeStaff, inactive: staff - activeStaff },
        admins: { total: admins, active: activeAdmins, inactive: admins - activeAdmins }
      },
      verified: verifiedUsers,
      unverified: totalUsers - verifiedUsers,
      recent: recentUsers
    };
  } catch (error) {
    logger.error('Error getting user stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê studios
 * @returns {Object} Studio statistics
 */
export const getStudioStats = async () => {
  try {
    const [
      totalStudios,
      activeStudios,
      inactiveStudios,
      maintenanceStudios,
      recentStudios // Studios created in last 30 days
    ] = await Promise.all([
      Studio.countDocuments(),
      Studio.countDocuments({ status: 'active' }),
      Studio.countDocuments({ status: 'inactive' }),
      Studio.countDocuments({ status: 'maintenance' }),
      Studio.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    return {
      total: totalStudios,
      byStatus: {
        active: activeStudios,
        inactive: inactiveStudios,
        maintenance: maintenanceStudios
      },
      recent: recentStudios
    };
  } catch (error) {
    logger.error('Error getting studio stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê equipment
 * @returns {Object} Equipment statistics
 */
export const getEquipmentStats = async () => {
  try {
    const [
      totalEquipment,
      availableEquipment,
      inUseEquipment,
      maintenanceEquipment,
      recentEquipment, // Equipment created in last 30 days
      totalQuantity,
      availableQuantity,
      inUseQuantity,
      maintenanceQuantity
    ] = await Promise.all([
      Equipment.countDocuments(),
      Equipment.countDocuments({ status: 'available' }),
      Equipment.countDocuments({ status: 'in_use' }),
      Equipment.countDocuments({ status: 'maintenance' }),
      Equipment.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      Equipment.find().select('totalQty availableQty inUseQty maintenanceQty').lean().then(equipments => ({
        total: equipments.reduce((sum, eq) => sum + (eq.totalQty || 0), 0)
      })),
      Equipment.find().select('totalQty availableQty inUseQty maintenanceQty').lean().then(equipments => ({
        total: equipments.reduce((sum, eq) => sum + (eq.availableQty || 0), 0)
      })),
      Equipment.find().select('totalQty availableQty inUseQty maintenanceQty').lean().then(equipments => ({
        total: equipments.reduce((sum, eq) => sum + (eq.inUseQty || 0), 0)
      })),
      Equipment.find().select('totalQty availableQty inUseQty maintenanceQty').lean().then(equipments => ({
        total: equipments.reduce((sum, eq) => sum + (eq.maintenanceQty || 0), 0)
      }))
    ]);

    const totalQty = totalQuantity[0]?.total || 0;
    const availableQty = availableQuantity[0]?.total || 0;
    const inUseQty = inUseQuantity[0]?.total || 0;
    const maintenanceQty = maintenanceQuantity[0]?.total || 0;

    return {
      total: totalEquipment,
      byStatus: {
        available: availableEquipment,
        in_use: inUseEquipment,
        maintenance: maintenanceEquipment
      },
      quantities: {
        total: totalQty,
        available: availableQty,
        in_use: inUseQty,
        maintenance: maintenanceQty,
        utilizationRate: totalQty > 0 ? ((inUseQty / totalQty) * 100).toFixed(2) : 0
      },
      recent: recentEquipment
    };
  } catch (error) {
    logger.error('Error getting equipment stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê promotions
 * @returns {Object} Promotion statistics
 */
export const getPromotionStats = async () => {
  try {
    const [
      totalPromotions,
      activePromotions,
      inactivePromotions,
      recentPromotions, // Promotions created in last 30 days
      expiringSoon // Promotions expiring in next 7 days
    ] = await Promise.all([
      Promotion.countDocuments(),
      Promotion.countDocuments({ isActive: true }),
      Promotion.countDocuments({ isActive: false }),
      Promotion.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      Promotion.countDocuments({
        endDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        isActive: true
      })
    ]);

    return {
      total: totalPromotions,
      active: activePromotions,
      inactive: inactivePromotions,
      recent: recentPromotions,
      expiringSoon: expiringSoon
    };
  } catch (error) {
    logger.error('Error getting promotion stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê notifications (simplified)
 * @returns {Object} Simplified notification statistics
 */
export const getNotificationStats = async () => {
  try {
    // Get active users to filter notifications
    const activeUserIds = await User.find({ isActive: true }).distinct('_id');

    const [
      totalNotifications,
      recentNotifications // Notifications created in last 7 days
    ] = await Promise.all([
      Notification.countDocuments({ userId: { $in: activeUserIds } }),
      Notification.countDocuments({
        userId: { $in: activeUserIds },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    return {
      total: totalNotifications,
      recent: recentNotifications
    };
  } catch (error) {
    logger.error('Error getting notification stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê bookings
 * @returns {Object} Booking statistics
 */
export const getBookingStats = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Use start of today without mutating now
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      checkedInBookings,
      completedBookings,
      cancelledBookings,
      thisMonthBookings,
      lastMonthBookings,
      todayBookings
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: BOOKING_STATUS.PENDING }),
      Booking.countDocuments({ status: BOOKING_STATUS.CONFIRMED }),
      Booking.countDocuments({ status: BOOKING_STATUS.CHECKED_IN }),
      Booking.countDocuments({ status: BOOKING_STATUS.COMPLETED }),
      Booking.countDocuments({ status: BOOKING_STATUS.CANCELLED }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      // Use $lt startOfMonth for accurate last month range
      Booking.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Booking.countDocuments({ createdAt: { $gte: startOfToday } })
    ]);

    // Calculate growth percentage
    const bookingGrowth = lastMonthBookings > 0 
      ? (((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100).toFixed(2)
      : thisMonthBookings > 0 ? 100 : 0;

    return {
      total: totalBookings,
      byStatus: {
        pending: pendingBookings,
        confirmed: confirmedBookings,
        checked_in: checkedInBookings,
        completed: completedBookings,
        cancelled: cancelledBookings
      },
      thisMonth: thisMonthBookings,
      lastMonth: lastMonthBookings,
      today: todayBookings,
      growth: parseFloat(bookingGrowth)
    };
  } catch (error) {
    logger.error('Error getting booking stats:', error);
    throw error;
  }
};

/**
 * Lấy thống kê doanh thu từ payments
 * @returns {Object} Revenue statistics
 */
export const getRevenueStats = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Aggregate total revenue from paid payments with paidAt existence check
    const [totalRevenue, monthlyRevenue, lastMonthRevenue, yearlyRevenue, paymentStats] = await Promise.all([
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID, paidAt: { $exists: true, $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        // Use $lt startOfMonth for accurate last month range
        { $match: { status: PAYMENT_STATUS.PAID, paidAt: { $exists: true, $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID, paidAt: { $exists: true, $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const total = totalRevenue[0]?.total || 0;
    const monthly = monthlyRevenue[0]?.total || 0;
    const lastMonth = lastMonthRevenue[0]?.total || 0;
    const yearly = yearlyRevenue[0]?.total || 0;

    // Calculate growth percentage
    const revenueGrowth = lastMonth > 0 
      ? (((monthly - lastMonth) / lastMonth) * 100).toFixed(2)
      : monthly > 0 ? 100 : 0;

    // Build payment status breakdown
    const paymentsByStatus = {};
    paymentStats.forEach(stat => {
      paymentsByStatus[stat._id] = {
        count: stat.count,
        amount: stat.total
      };
    });

    return {
      total,
      monthly,
      lastMonth,
      yearly,
      growth: parseFloat(revenueGrowth),
      byStatus: paymentsByStatus,
      currency: 'VND'
    };
  } catch (error) {
    logger.error('Error getting revenue stats:', error);
    throw error;
  }
};

/**
 * Lấy toàn bộ dashboard statistics
 * @returns {Object} Complete dashboard stats
 */
export const getDashboardStats = async () => {
  try {
    const [
      userStats,
      studioStats,
      equipmentStats,
      promotionStats,
      notificationStats,
      bookingStats,
      revenueStats
    ] = await Promise.all([
      getUserStats(),
      getStudioStats(),
      getEquipmentStats(),
      getPromotionStats(),
      getNotificationStats(),
      getBookingStats(),
      getRevenueStats()
    ]);

    return {
      users: userStats,
      studios: studioStats,
      equipment: equipmentStats,
      promotions: promotionStats,
      notifications: notificationStats,
      bookings: bookingStats,
      revenue: revenueStats,
      generatedAt: new Date()
    };
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    throw error;
  }
};


/**
 * Cleanup orphaned notifications (notifications của users đã bị xóa)
 * @returns {Object} Cleanup result
 */
export const cleanupOrphanedNotifications = async () => {
  try {
    // Get all existing user IDs
    const existingUserIds = await User.find({}).distinct('_id');

    // Find notifications with non-existing userIds
    const orphanedNotifications = await Notification.find({
      userId: { $nin: existingUserIds }
    });

    const count = orphanedNotifications.length;

    if (count > 0) {
      await Notification.deleteMany({
        userId: { $nin: existingUserIds }
      });
      logger.info(`Cleaned up ${count} orphaned notifications`);
    }

    return {
      orphanedCount: count,
      cleaned: count > 0
    };
  } catch (error) {
    logger.error('Error cleaning up orphaned notifications:', error);
    throw error;
  }
};

// #endregion