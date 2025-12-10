// #region Imports
import Message from '../models/Message/message.model.js';
import { createAndSendNotification } from './notification.service.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';
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
    // Validate fromUserId
    if (!fromUserId) {
      throw new Error('ID người gửi là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(fromUserId)) {
      throw new Error('ID người gửi không hợp lệ');
    }

    // Validate toUserId
    if (!toUserId) {
      throw new Error('ID người nhận là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      throw new Error('ID người nhận không hợp lệ');
    }

    // Validate content
    if (!content) {
      throw new Error('Nội dung tin nhắn là bắt buộc');
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Nội dung tin nhắn không được để trống');
    }
    const MAX_CONTENT_LENGTH = 5000;
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Nội dung tin nhắn không được vượt quá ${MAX_CONTENT_LENGTH} ký tự`);
    }

    // Validate bookingId nếu được cung cấp
    if (bookingId && !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new Error('ID booking không hợp lệ');
    }

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
      // Sort userIds to ensure consistent room names (A-B and B-A -> same room)
      const room = bookingId || [fromUserId, toUserId].sort().join('-');
      io.to(room).emit('message', {
        id: message._id,
        fromUserId: {
          _id: message.fromUserId?._id,
          username: message.fromUserId?.username,
          fullName: message.fromUserId?.fullName,
        },
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
    if (!userId) {
      throw new Error('ID người dùng là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ');
    }

    // Lấy conversations theo booking (nếu có booking module)
    const bookingMessages = await Message.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
      bookingId: { $ne: null }
    }).sort({ createdAt: -1 })
      .populate('fromUserId', 'username fullName avatar')
      .populate('toUserId', 'username fullName avatar');

    // Group booking messages by bookingId
    const bookingConversationsMap = new Map();
    for (const message of bookingMessages) {
      const bookingId = message.bookingId.toString();

      if (!bookingConversationsMap.has(bookingId)) {
        bookingConversationsMap.set(bookingId, {
          _id: bookingId,
          messages: [],
          lastMessage: message,
          unreadCount: 0
        });
      }

      const conversation = bookingConversationsMap.get(bookingId);
      conversation.messages.push(message);

      // Count unread messages for this user
      if (message.toUserId.toString() === userId && !message.isRead) {
        conversation.unreadCount++;
      }

      // Update last message if newer
      if (message.createdAt > conversation.lastMessage.createdAt) {
        conversation.lastMessage = message;
      }
    }

    const bookingConversations = Array.from(bookingConversationsMap.values())
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);

    // Lấy direct conversations (không có bookingId) - sử dụng JavaScript grouping
    const directMessages = await Message.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
      bookingId: null
    }).sort({ createdAt: -1 })
      .populate('fromUserId', 'username fullName avatar')
      .populate('toUserId', 'username fullName avatar');

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
    if (!bookingId) {
      throw new Error('ID booking là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new Error('ID booking không hợp lệ');
    }
    if (!userId) {
      throw new Error('ID người dùng là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ');
    }

    // Validate pagination
    if (page < 1) {
      throw new Error('Số trang phải lớn hơn 0');
    }
    if (limit < 1 || limit > 100) {
      throw new Error('Giới hạn phải từ 1 đến 100');
    }

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
    if (!messageId) {
      throw new Error('ID tin nhắn là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new Error('ID tin nhắn không hợp lệ');
    }
    if (!userId) {
      throw new Error('ID người dùng là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ');
    }

    const message = await Message.findOneAndUpdate(
      { _id: messageId, toUserId: userId },
      { isRead: true },
      { new: true }
    );

    if (!message) {
      throw new Error('Tin nhắn không tồn tại hoặc bạn không có quyền truy cập');
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
    if (!messageId) {
      throw new Error('ID tin nhắn là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new Error('ID tin nhắn không hợp lệ');
    }
    if (!userId) {
      throw new Error('ID người dùng là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ');
    }

    const message = await Message.findOneAndDelete({
      _id: messageId,
      $or: [{ fromUserId: userId }, { toUserId: userId }]
    });

    if (!message) {
      throw new Error('Tin nhắn không tồn tại hoặc bạn không có quyền truy cập');
    }

    logger.info(`Message ${messageId} deleted`);
  } catch (error) {
    logger.error('Error deleting message:', error);
    throw error;
  }
};

// #endregion