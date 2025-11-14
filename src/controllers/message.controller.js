// #region Imports
import asyncHandler from 'express-async-handler';
import Message from '../models/Message/message.model.js';
import {
  createMessage,
  getConversations,
  getMessagesInConversation,
  markMessageAsRead,
  deleteMessage,
} from '../services/message.service.js';
import { io } from '../../server.js'; // Import io từ server.js
import logger from '../utils/logger.js';
// #endregion

// #region Message Controller

/**
 * Tạo message mới
 * POST /api/messages
 */
export const createMessageController = asyncHandler(async (req, res) => {
  const { toUserId, content, bookingId } = req.body;
  const fromUserId = req.user.id;

  if (!toUserId || !content) {
    res.status(400);
    throw new Error('toUserId và content là bắt buộc');
  }

  const message = await createMessage(fromUserId, toUserId, content, bookingId, io);

  res.status(201).json({
    success: true,
    message: 'Message đã được tạo',
    data: message,
  });
});

/**
 * Lấy danh sách conversations
 * GET /api/messages/conversations
 */
export const getConversationsController = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const conversations = await getConversations(userId);

  res.json({
    success: true,
    data: conversations,
  });
});

/**
 * Lấy messages trong conversation (theo bookingId hoặc direct conversation)
 * GET /api/messages/conversation/:conversationId
 * conversationId có thể là bookingId hoặc userId-userId format
 */
export const getMessagesInConversationController = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;
  const { page, limit } = req.query;

  // Check if conversationId is a valid ObjectId (booking conversation)
  const isBookingConversation = /^[0-9a-fA-F]{24}$/.test(conversationId);

  let messages, total;

  if (isBookingConversation) {
    // Booking conversation
    [messages, total] = await Promise.all([
      Message.find({ bookingId: conversationId })
        .sort({ createdAt: -1 })
        .skip((parseInt(page) || 1 - 1) * (parseInt(limit) || 20))
        .limit(parseInt(limit) || 20)
        .populate('fromUserId', 'username fullName')
        .populate('toUserId', 'username fullName'),
      Message.countDocuments({ bookingId: conversationId })
    ]);
  } else {
    // Direct conversation (format: userId1-userId2)
    const [userId1, userId2] = conversationId.split('-');
    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Verify user is participant
    if (userId !== userId1 && userId !== userId2) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    [messages, total] = await Promise.all([
      Message.find({
        bookingId: null,
        $or: [
          { fromUserId: userId1, toUserId: userId2 },
          { fromUserId: userId2, toUserId: userId1 }
        ]
      })
        .sort({ createdAt: -1 })
        .skip((parseInt(page) || 1 - 1) * (parseInt(limit) || 20))
        .limit(parseInt(limit) || 20)
        .populate('fromUserId', 'username fullName')
        .populate('toUserId', 'username fullName'),
      Message.countDocuments({
        bookingId: null,
        $or: [
          { fromUserId: userId1, toUserId: userId2 },
          { fromUserId: userId2, toUserId: userId1 }
        ]
      })
    ]);
  }

  res.json({
    success: true,
    data: {
      messages: messages.reverse(), // Reverse để hiển thị cũ -> mới
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        totalPages: Math.ceil(total / (parseInt(limit) || 20)),
      },
    },
  });
});

/**
 * Đánh dấu message đã đọc
 * PUT /api/messages/:id/read
 */
export const markMessageAsReadController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const message = await markMessageAsRead(id, userId);

  res.json({
    success: true,
    message: 'Message đã được đánh dấu đã đọc',
    data: message,
  });
});

/**
 * Xóa message
 * DELETE /api/messages/:id
 */
export const deleteMessageController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await deleteMessage(id, userId);

  res.json({
    success: true,
    message: 'Message đã được xóa',
  });
});

// #endregion