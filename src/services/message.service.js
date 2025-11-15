// #region Imports
import Message from '../models/Message/message.model.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';
// #endregion

// #region Message Service

/**
 * Tạo message mới và gửi notification
 * @param {string} fromUserId - ID người gửi
 * @param {string} toUserId - ID người nhận
 * @param {string} content - Nội dung message
 * @param {string} bookingId - ID booking (optional)
 * @param {Object} io - Socket.io instance (optional)
 * @returns {Object} Message object
 */
export const createMessage = async (fromUserId, toUserId, content, bookingId = null, io = null) => {
  try {
    const message = new Message({
      fromUserId,
      toUserId,
      content,
      bookingId,
    });

    await message.save();

    // Fetch sender name for better notification
    await message.populate('fromUserId', 'username fullName');
    const senderName = message.fromUserId?.fullName || message.fromUserId?.username || 'Someone';

    // Gửi notification đến người nhận
    await createAndSendNotification(
      toUserId,
      NOTIFICATION_TYPE.MESSAGE,
      'Tin nhắn mới',
      `Bạn có tin nhắn từ ${senderName}`,
      false, // Không gửi email
      io,
      message._id
    );

    // Emit real-time message
    if (io) {
      const room = bookingId || `${fromUserId}-${toUserId}`;
      io.to(room).emit('message', {
        id: message._id,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        content: message.content,
        bookingId: message.bookingId,
        createdAt: message.createdAt,
      });
    }

    logger.info(`Message created from ${fromUserId} to ${toUserId}`);
    return message;
  } catch (error) {
    logger.error('Error creating message:', error);
    throw error;
  }
};

/**
 * Lấy danh sách conversations cho user (nhóm theo bookingId hoặc direct messaging)
 * @param {string} userId - ID user
 * @returns {Array} Danh sách conversations
 */
export const getConversations = async (userId) => {
  try {
    // Lấy conversations theo booking (nếu có booking module)
    const bookingConversations = await Message.aggregate([
      {
        $match: {
          $or: [{ fromUserId: userId }, { toUserId: userId }],
          bookingId: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$bookingId",
          messages: { $push: "$$ROOT" },
          lastMessage: { $last: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$toUserId", userId] }, { $eq: ["$isRead", false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { "lastMessage.createdAt": -1 } }
    ]);

    // Lấy direct conversations (không có bookingId) - sử dụng JavaScript grouping
    const directMessages = await Message.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
      bookingId: null
    }).sort({ createdAt: -1 });

    // Group by conversation
    const directConversationsMap = new Map();
    for (const message of directMessages) {
      const participants = [message.fromUserId.toString(), message.toUserId.toString()].sort();
      const conversationId = participants.join('-');

      if (!directConversationsMap.has(conversationId)) {
        directConversationsMap.set(conversationId, {
          _id: conversationId,
          messages: [],
          lastMessage: message,
          unreadCount: 0
        });
      }

      const conversation = directConversationsMap.get(conversationId);
      conversation.messages.push(message);

      // Count unread messages for this user
      if (message.toUserId.toString() === userId && !message.isRead) {
        conversation.unreadCount++;
      }
    }

    const directConversations = Array.from(directConversationsMap.values());

    // Merge và sort tất cả conversations
    const allConversations = [...bookingConversations, ...directConversations]
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    return allConversations;
  } catch (error) {
    logger.error('Error getting conversations:', error);
    throw error;
  }
};

/**
 * Lấy messages trong một conversation (theo bookingId)
 * @param {string} bookingId - ID booking
 * @param {string} userId - ID user (để verify access)
 * @param {Object} options - { page, limit }
 * @returns {Object} Paginated messages
 */
export const getMessagesInConversation = async (bookingId, userId, { page = 1, limit = 20 } = {}) => {
  try {
    // Verify user is participant in booking (placeholder - cần check Booking model)
    // For now, assume access if user has messages in conversation

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ bookingId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('fromUserId', 'username fullName')
        .populate('toUserId', 'username fullName'),
      Message.countDocuments({ bookingId })
    ]);

    return {
      messages: messages.reverse(), // Reverse để hiển thị cũ -> mới
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error getting messages in conversation:', error);
    throw error;
  }
};

/**
 * Đánh dấu message đã đọc
 * @param {string} messageId - ID message
 * @param {string} userId - ID user (verify ownership)
 * @returns {Object} Updated message
 */
export const markMessageAsRead = async (messageId, userId) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: messageId, toUserId: userId },
      { isRead: true },
      { new: true }
    );

    if (!message) {
      throw new Error('Message not found or not owned by user');
    }

    logger.info(`Message ${messageId} marked as read`);
    return message;
  } catch (error) {
    logger.error('Error marking message as read:', error);
    throw error;
  }
};

/**
 * Xóa message
 * @param {string} messageId - ID message
 * @param {string} userId - ID user (verify ownership)
 */
export const deleteMessage = async (messageId, userId) => {
  try {
    const message = await Message.findOneAndDelete({
      _id: messageId,
      $or: [{ fromUserId: userId }, { toUserId: userId }]
    });

    if (!message) {
      throw new Error('Message not found or not owned by user');
    }

    logger.info(`Message ${messageId} deleted`);
  } catch (error) {
    logger.error('Error deleting message:', error);
    throw error;
  }
};

// #endregion