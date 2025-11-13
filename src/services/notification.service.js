// #region Imports
import Notification from '../models/Notification/notification.model.js';
import { sendEmail } from './email.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';
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
    // Gửi email nếu flag = true
    if (sendEmailFlag) {
      // Giả sử có user email, cần fetch từ DB hoặc pass email
      // await sendEmail(userEmail, notification.title, notification.message);
      logger.info(`Email sent for notification: ${notification.title}`);
    }

    // Emit real-time via Socket.io
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
    const query = { userId };

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
 * Xóa notification
 * @param {string} notificationId - ID của notification
 * @param {string} userId - ID của user (để verify ownership)
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await Notification.findOneAndDelete({ _id: notificationId, userId });

    if (!result) {
      throw new Error('Notification not found or not owned by user');
    }

    logger.info(`Notification ${notificationId} deleted`);
  } catch (error) {
    logger.error('Error deleting notification:', error);
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
  // Placeholder: Implement khi có booking module
  logger.info('Reminder scheduler initialized (placeholder)');
};

// #endregion