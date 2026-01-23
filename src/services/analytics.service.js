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
      revenueStats,
      revenueChart,
      bookingChart,
      reportStats,
      topStudios,
      operationalMetrics
    ] = await Promise.all([
      getUserStats(),
      getStudioStats(),
      getEquipmentStats(),
      getPromotionStats(),
      getNotificationStats(),
      getBookingStats(),
      getRevenueStats(),
      getRevenueChart(),
      getBookingChart(),
      getReportStats(),
      getTopStudios(),
      getOperationalMetrics()
    ]);

    return {
      users: userStats,
      studios: studioStats,
      equipment: equipmentStats,
      promotions: promotionStats,
      notifications: notificationStats,
      bookings: bookingStats,
      revenue: revenueStats,
      charts: {
        revenue: revenueChart,
        bookings: bookingChart
      },
      reports: reportStats,
      rankings: {
        topStudios
      },
      operations: operationalMetrics,
      generatedAt: new Date()
    };
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    throw error;
  }
};


/**
 * Lấy dữ liệu biểu đồ doanh thu (30 ngày gần nhất)
 * @returns {Array} Revenue chart data
 */
export const getRevenueChart = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: PAYMENT_STATUS.PAID,
          paidAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          value: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing dates
    const chartData = [];
    const currentDate = new Date(thirtyDaysAgo);
    const now = new Date();

    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const found = revenueData.find(item => item._id === dateStr);
      chartData.push({
        date: dateStr,
        value: found ? found.value : 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  } catch (error) {
    logger.error('Error getting revenue chart:', error);
    return [];
  }
};

/**
 * Lấy dữ liệu biểu đồ booking (30 ngày gần nhất)
 * @returns {Array} Booking chart data
 */
export const getBookingChart = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const bookingData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing dates
    const chartData = [];
    const currentDate = new Date(thirtyDaysAgo);
    const now = new Date();

    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const found = bookingData.find(item => item._id === dateStr);
      chartData.push({
        date: dateStr,
        count: found ? found.count : 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  } catch (error) {
    logger.error('Error getting booking chart:', error);
    return [];
  }
};

/**
 * Lấy thống kê Report
 * @returns {Object} Report statistics
 */
export const getReportStats = async () => {
    try {
      const { default: Report } = await import('../models/Report/report.model.js');
      const [
        totalReports,
        pendingReports,
        resolvedReports,
        reportsWithType
      ] = await Promise.all([
        Report.countDocuments(),
        Report.countDocuments({ status: 'pending' }),
        Report.countDocuments({ status: 'resolved' }),
        Report.aggregate([
          {
            $group: {
              _id: '$issueType',
              count: { $sum: 1 }
            }
          }
        ])
      ]);
  
      const byType = {};
      reportsWithType.forEach(item => {
        byType[item._id] = item.count;
      });
  
      return {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        resolutionRate: totalReports > 0 ? ((resolvedReports / totalReports) * 100).toFixed(2) : 0,
        byType
      };
    } catch (error) {
      logger.error('Error getting report stats:', error);
      // Return default internal structure if error happens (e.g. model not found yet)
      return { total: 0, pending: 0, resolved: 0, resolutionRate: 0, byType: {} };
    }
  };

/**
 * Lấy Top Studios (Ranking)
 * @returns {Array} Top 5 studios
 */
export const getTopStudios = async () => {
  try {
    const { default: Schedule } = await import('../models/Schedule/schedule.model.js');
    
    // Find top studios by finding completed schedules/bookings
    // This is an estimation based on bookings
    const topStudios = await Booking.aggregate([
        { $match: { status: BOOKING_STATUS.COMPLETED } },
        {
            $lookup: {
                from: 'schedules',
                localField: 'scheduleId',
                foreignField: '_id',
                as: 'schedule'
            }
        },
        { $unwind: '$schedule' },
        {
            $group: {
                _id: '$schedule.studioId',
                revenue: { $sum: '$finalAmount' },
                bookingsCount: { $sum: 1 }
            }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'studios',
                localField: '_id',
                foreignField: '_id',
                as: 'studioInfo'
            }
        },
        { $unwind: '$studioInfo' },
        {
            $project: {
                name: '$studioInfo.name',
                revenue: 1,
                bookingsCount: 1
            }
        }
    ]);

    return topStudios;
  } catch (error) {
    logger.error('Error getting top studios:', error);
    return [];
  }
};

/**
 * Lấy chỉ số vận hành (Operational Metrics)
 * @returns {Object} Metric data
 */
export const getOperationalMetrics = async () => {
    try {
        const { default: Schedule } = await import('../models/Schedule/schedule.model.js');
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // 1. Cancellation Rate
        const [totalBookings, cancelledBookings] = await Promise.all([
            Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Booking.countDocuments({ 
                createdAt: { $gte: startOfMonth },
                status: BOOKING_STATUS.CANCELLED
            })
        ]);
        
        const cancellationRate = totalBookings > 0 
            ? ((cancelledBookings / totalBookings) * 100).toFixed(2) 
            : 0;

        // 2. Occupancy Rate (Month)
        // Formula: (Total Hours Booked) / (Total Hours Available) * 100
        // Assumption: Open 24/7 (24h * DaysInMonth * TotalActiveStudios)
        
        const totalActiveStudios = await Studio.countDocuments({ status: 'active' });
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalCapacityHours = totalActiveStudios * daysInMonth * 24; // 24/7

        // Calculate booked hours
        const bookedSchedules = await Schedule.find({
            status: { $in: ['booked', 'ongoing', 'completed'] },
            startTime: { $gte: startOfMonth }
        }).select('startTime endTime');

        let totalBookedHours = 0;
        bookedSchedules.forEach(s => {
            const diff = (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60);
            totalBookedHours += diff;
        });

        const occupancyRate = totalCapacityHours > 0 
            ? ((totalBookedHours / totalCapacityHours) * 100).toFixed(2)
            : 0;

        return {
            cancellationRate: parseFloat(cancellationRate),
            occupancyRate: parseFloat(occupancyRate),
            totalBookedHours: Math.round(totalBookedHours),
            totalCapacityHours
        };

    } catch (error) {
        logger.error('Error getting operational metrics:', error);
        return { cancellationRate: 0, occupancyRate: 0 };
    }
}

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