// #region Imports
import Notification from '../models/Notification/notification.model.js';
import User from '../models/User/user.model.js';
import { sendEmail } from './email.service.js';
import logger from '../utils/logger.js';
import Schedule from '../models/Schedule/schedule.model.js';
import Booking from '../models/Booking/booking.model.js';
import Payment from '../models/Payment/payment.model.js';
import cron from 'node-cron';
import { BOOKING_STATUS, PAYMENT_STATUS, NOTIFICATION_TYPE } from '../utils/constants.js';

// Rate limiting cache (in-memory, should use Redis in production)
const emailRateLimit = new Map();
// #endregion

// #region Notification Service

/**
 * Tạo notification mới (internal)
 * @param {string} userId - ID của user nhận notification
 * @param {string} type - Loại notification (từ NOTIFICATION_TYPE)
 * @param {string} title - Tiêu đề
 * @param {string} message - Nội dung
 * @param {string} relatedId - ID liên quan (optional)
 * @returns {Object} Notification object
 */
const createNotification = async (userId, type, title, message, relatedId = null) => {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      relatedId,
    });

    await notification.save();
    logger.info(`Notification created for user ${userId}: ${title}`);

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Tạo và gửi notification (in-app + email + real-time)
 * @param {string} userId - ID của user nhận notification
 * @param {string} type - Loại notification (từ NOTIFICATION_TYPE)
 * @param {string} title - Tiêu đề
 * @param {string} message - Nội dung
 * @param {boolean} sendEmail - Có gửi email không
 * @param {Object} io - Socket.io instance (optional)
 * @param {string} relatedId - ID liên quan (optional)
 * @returns {Object} Notification object
 */
export const createAndSendNotification = async (userId, type, title, message, sendEmail = false, io = null, relatedId = null) => {
  try {
    const notification = await createNotification(userId, type, title, message, relatedId);
    await sendNotification(notification, sendEmail, io);
    return notification;
  } catch (error) {
    logger.error('Error creating and sending notification:', error);
    throw error;
  }
};

/**
 * Gửi notification (in-app + email nếu cần)
 * @param {Object} notification - Notification object
 * @param {boolean} sendEmailFlag - Có gửi email không
 * @param {Object} io - Socket.io instance (optional)
 */
export const sendNotification = async (notification, sendEmailFlag = false, io = null) => {
  try {
    // Gửi email nếu flag = true và vượt qua anti-spam checks
    if (sendEmailFlag) {
      // Kiểm tra user preferences
      const allowEmail = await checkUserPreferences(notification.userId);
      if (!allowEmail) {
        logger.info(`Email blocked by user preferences for user ${notification.userId}`);
      } else {
        // Kiểm tra rate limiting
        const canSend = checkRateLimit(notification.userId);
        if (!canSend) {
          logger.warn(`Email rate limited for user ${notification.userId}`);
        } else {
          // Gửi email
          const user = await User.findById(notification.userId).select('email');
          if (user && user.email) {
            await sendEmail(user.email, notification.title, notification.message);
            logger.info(`Email sent for notification: ${notification.title}`);
          }
        }
      }
    }

    // Emit real-time via Socket.io (always send regardless of email status)
    if (io) {
      io.to(notification.userId.toString()).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      });
      logger.info(`Real-time notification sent to user ${notification.userId}`);
    }
  } catch (error) {
    logger.error('Error sending notification:', error);
  }
};

/**
 * Lấy danh sách notifications cho user
 * @param {string} userId - ID của user
 * @param {Object} filters - Filters (page, limit, isRead, type)
 * @returns {Object} Paginated notifications
 */
export const getNotifications = async (userId, { page = 1, limit = 10, isRead, type } = {}) => {
  try {
    const query = { userId, isDeleted: false };

    if (isRead !== undefined) {
      query.isRead = isRead;
    }

    if (type) {
      query.type = type;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Notification.countDocuments(query),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error getting notifications:', error);
    throw error;
  }
};

/**
 * Đánh dấu notification đã đọc
 * @param {string} notificationId - ID của notification
 * @param {string} userId - ID của user (để verify ownership)
 * @returns {Object} Updated notification
 */
export const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found or not owned by user');
    }

    logger.info(`Notification ${notificationId} marked as read`);
    return notification;
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Xóa notification (Soft delete)
 * @param {string} notificationId - ID của notification
 * @param {string} userId - ID của user (để verify ownership)
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isDeleted: true },
      { new: true }
    );

    if (!result) {
      throw new Error('Notification not found or not owned by user');
    }

    logger.info(`Notification ${notificationId} soft deleted`);
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Xóa tất cả notification đã đọc (Soft delete)
 * @param {string} userId - ID của user
 */
export const deleteAllReadNotifications = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: true, isDeleted: false },
      { isDeleted: true }
    );

    logger.info(`Soft deleted ${result.modifiedCount} read notifications for user ${userId}`);
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error deleting all read notifications:', error);
    throw error;
  }
};

/**
 * Gửi notification thủ công (cho admin/staff)
 * @param {Object} data - { userId, type, title, message, sendEmail }
 * @param {Object} io - Socket.io instance
 */
export const sendManualNotification = async (data, io = null) => {
  try {
    const notification = await createNotification(
      data.userId,
      data.type || NOTIFICATION_TYPE.INFO,
      data.title,
      data.message,
      data.relatedId
    );

    await sendNotification(notification, data.sendEmail, io);
    return notification;
  } catch (error) {
    logger.error('Error sending manual notification:', error);
    throw error;
  }
};

/**
 * Schedule reminders (placeholder cho future booking reminders)
 * Sử dụng node-cron để chạy định kỳ
 */
export const scheduleReminders = () => {
  // Run every 10 minutes for faster testing
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running scheduled reminders job');

    try {
      const now = new Date();
      const startWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
      const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h

      // Find schedules booked that start in ~24-25 hours and have a booking
      const schedules = await Schedule.find({
        bookingId: { $exists: true, $ne: null },
        startTime: { $gte: startWindow, $lt: endWindow }
      }).lean();

      for (const sched of schedules) {
        try {
          const booking = await Booking.findById(sched.bookingId).lean();
          if (!booking) continue;
          // Skip completed or cancelled bookings
          if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.CANCELLED) continue;

          // Calculate total paid for this booking
          const paidPayments = await Payment.find({
            bookingId: booking._id,
            status: PAYMENT_STATUS.PAID
          }).select('amount');

          const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
          const remaining = booking.finalAmount - totalPaid;
          if (remaining <= 0) continue; // nothing to remind

          // Avoid duplicate reminders: check notifications for this booking in last 48 hours
          const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
          const existing = await Notification.findOne({
            userId: booking.userId,
            type: NOTIFICATION_TYPE.REMINDER,
            relatedId: booking._id,
            createdAt: { $gte: twoDaysAgo }
          }).lean();

          if (existing) continue;

          // Create in-app notification (don't send email here via that helper)
          const userId = booking.userId;
          const title = 'Nhắc thanh toán phần còn lại';
          const message = `Bạn còn ${remaining} VND cần thanh toán cho booking #${booking._id.toString().slice(-8)} trước khi sử dụng dịch vụ vào ${new Date(sched.startTime).toLocaleString('vi-VN')}. Vui lòng thanh toán để tránh ảnh hưởng.`;

          await createAndSendNotification(userId, NOTIFICATION_TYPE.REMINDER, title, message, false, null, booking._id);

          // Also send an email to customer and CC all staff/admin emails (best-effort)
          try {
            // Fetch staff/admin emails
            const staffUsers = await User.find({ role: { $in: ['staff', 'admin'] }, email: { $exists: true, $ne: null } }).select('email').lean();
            const ccList = staffUsers.map(u => u.email).filter(Boolean);

            // Build simple HTML for email
            const html = `
              <p>Xin chào,</p>
              <p>${message}</p>
              <p>Link thanh toán sẽ được gửi qua ứng dụng hoặc bạn có thể liên hệ nhân viên để được hỗ trợ.</p>
              <p>Trân trọng,<br/>StudioForRent Team</p>
            `;

            // sendEmail imported above; ccList may be empty
            await sendEmail((await User.findById(userId).select('email').lean()).email, title, html, ccList.length ? ccList : null);
            logger.info('Sent remaining payment reminder email with CC to staff', { bookingId: booking._id, userId, ccCount: ccList.length });
          } catch (emailErr) {
            logger.warn('Failed to send reminder email with CC', { bookingId: booking._id, error: emailErr?.message || emailErr });
          }

        } catch (innerErr) {
          logger.error('Error processing scheduled reminder for schedule', { scheduleId: sched._id, error: innerErr.message });
        }
      }

    } catch (err) {
      logger.error('Scheduled reminders job failed:', err.message || err);
    }
  });

  logger.info('Reminder scheduler initialized');
};

// #endregion

// #region Anti-Spam Functions

/**
 * Kiểm tra rate limiting cho email
 * @param {string} userId - ID của user
 * @param {number} maxEmailsPerHour - Số email tối đa trong 1 giờ (default: 10)
 * @returns {boolean} True nếu được phép gửi email
 */
const checkRateLimit = (userId, maxEmailsPerHour = 10) => {
  const now = Date.now();
  const userKey = `email_${userId}`;
  const userData = emailRateLimit.get(userKey) || { count: 0, resetTime: now + 3600000 }; // 1 hour

  if (now > userData.resetTime) {
    // Reset counter
    userData.count = 0;
    userData.resetTime = now + 3600000;
  }

  if (userData.count >= maxEmailsPerHour) {
    logger.warn(`Rate limit exceeded for user ${userId}: ${userData.count}/${maxEmailsPerHour} emails`);
    return false;
  }

  userData.count++;
  emailRateLimit.set(userKey, userData);
  return true;
};

/**
 * Kiểm tra user preferences cho email notifications
 * @param {string} userId - ID của user
 * @returns {boolean} True nếu user cho phép nhận email
 */
const checkUserPreferences = async (userId) => {
  try {
    const user = await User.findById(userId).select('preferences');
    if (!user || !user.preferences) return true; // Default: allow emails

    return user.preferences.emailNotifications !== false;
  } catch (error) {
    logger.error('Error checking user preferences:', error);
    return true; // Default: allow emails on error
  }
};

/**
 * Gửi digest email (tóm tắt notifications trong ngày)
 * @param {string} userId - ID của user
 * @param {Array} notifications - Danh sách notifications
 */
const sendDigestEmail = async (userId, notifications) => {
  try {
    const user = await User.findById(userId).select('email name');
    if (!user || !user.email) return;

    const digestContent = notifications
      .map(n => `- ${n.title}: ${n.message}`)
      .join('\n');

    const subject = `Daily Notification Digest - ${notifications.length} updates`;
    const html = `
      <h2>Hello ${user.name || 'User'},</h2>
      <p>Here's a summary of your notifications from today:</p>
      <pre>${digestContent}</pre>
      <p>Best regards,<br>StudioForRent Team</p>
    `;

    await sendEmail(user.email, subject, html);
    logger.info(`Digest email sent to user ${userId} with ${notifications.length} notifications`);
  } catch (error) {
    logger.error('Error sending digest email:', error);
  }
};

/**
 * Gửi batch notifications với delay để tránh spam
 * @param {Array} notifications - Danh sách notifications cần gửi
 * @param {Object} io - Socket.io instance
 * @param {number} delayMs - Delay giữa các email (default: 1000ms)
 */
export const batchSendNotifications = async (notifications, io = null, delayMs = 1000) => {
  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const notification of notifications) {
    try {
      // Kiểm tra user preferences
      const allowEmail = await checkUserPreferences(notification.userId);
      if (!allowEmail) {
        results.skipped++;
        continue;
      }

      // Kiểm tra rate limiting
      const canSend = checkRateLimit(notification.userId);
      if (!canSend) {
        // Thay vì skip, có thể queue cho digest email
        logger.info(`Email rate limited for user ${notification.userId}, queuing for digest`);
        results.skipped++;
        continue;
      }

      // Gửi notification
      await sendNotification(notification, true, io);
      results.sent++;

      // Delay để tránh spam
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      logger.error(`Error sending batch notification ${notification._id}:`, error);
      results.errors++;
    }
  }

  logger.info(`Batch notification results: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`);
  return results;
};

/**
 * Cleanup rate limit cache (gọi định kỳ)
 */
export const cleanupRateLimitCache = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, data] of emailRateLimit.entries()) {
    if (now > data.resetTime) {
      emailRateLimit.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired rate limit entries`);
  }
};


// #endregion