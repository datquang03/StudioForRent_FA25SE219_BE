// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getNotifications,
  markAsRead,
  deleteNotification,
  createAndSendNotification,
  deleteAllReadNotifications,
} from '../services/notification.service.js';
// #endregion

// #region Notification Controllers

/**
 * Lấy danh sách notifications cho user hiện tại
 */
export const getNotificationsController = asyncHandler(async (req, res) => {
  const { page, limit, isRead, type } = req.query;

  const result = await getNotifications(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    type,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách thông báo thành công!',
    data: result,
  });
});

/**
 * Đánh dấu notification đã đọc
 */
export const markAsReadController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await markAsRead(id, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Đánh dấu đã đọc thành công!',
    data: notification,
  });
});

/**
 * Xóa notification
 */
export const deleteNotificationController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await deleteNotification(id, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Xóa thông báo thành công!',
  });
});

/**
 * Xóa tất cả notification đã đọc
 */
export const deleteAllReadNotificationsController = asyncHandler(async (req, res) => {
  const count = await deleteAllReadNotifications(req.user.id);

  res.status(200).json({
    success: true,
    message: `Đã xóa ${count} thông báo đã đọc!`,
    data: { count }
  });
});

/**
 * Gửi notification thủ công (cho admin/staff)
 */
export const sendManualNotificationController = asyncHandler(async (req, res) => {
  const { userId, type, title, message, sendEmail, relatedId } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin bắt buộc: userId, title, message',
    });
  }

  const notification = await createAndSendNotification(
    userId,
    type || 'INFO',
    title,
    message,
    sendEmail,
    req.io, // pass io for real-time
    relatedId
  );

  res.status(201).json({
    success: true,
    message: 'Gửi thông báo thành công!',
    data: notification,
  });
});

// #endregion
