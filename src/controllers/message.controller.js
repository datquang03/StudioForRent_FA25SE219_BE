// #region Imports
import asyncHandler from 'express-async-handler';
import Message from '../models/Message/message.model.js';
import User from '../models/User/user.model.js';
import Booking from '../models/Booking/booking.model.js';
import {
  createMessage,
  getConversations,
  markMessageAsRead,
  deleteMessage,
} from '../services/message.service.js';
import { uploadMultipleImages } from '../services/upload.service.js';
import mongoose from 'mongoose';
// #endregion

// #region Message Controller

/**
 * Tạo message mới
 * POST /api/messages
 */
export const createMessageController = asyncHandler(async (req, res) => {
  const { toUserId, content, bookingId } = req.body;
  const fromUserId = req.user.id;

  // Validation
  if (!toUserId) {
    res.status(400);
    throw new Error('toUserId là bắt buộc');
  }

  // Content or files required
  if ((!content || content.trim().length === 0) && (!req.files || req.files.length === 0)) {
    res.status(400);
    throw new Error('Nội dung hoặc hình ảnh là bắt buộc');
  }

  // Validate toUserId is valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    res.status(400);
    throw new Error('toUserId không hợp lệ');
  }

  // Check user cannot message themselves
  if (fromUserId === toUserId) {
    res.status(400);
    throw new Error('Không thể gửi tin nhắn cho chính mình');
  }

  // Validate content length
  if (content.trim().length === 0 || content.length > 5000) {
    res.status(400);
    throw new Error('Nội dung tin nhắn phải từ 1-5000 ký tự');
  }

  // Check toUser exists
  const toUser = await User.findById(toUserId);
  if (!toUser) {
    res.status(404);
    throw new Error('Người nhận không tồn tại');
  }

  // Validate bookingId if provided
  if (bookingId && !mongoose.Types.ObjectId.isValid(bookingId)) {
    res.status(400);
    throw new Error('bookingId không hợp lệ');
  }



  // Handle image upload
  let attachments = [];
  if (req.files && req.files.length > 0) {
    const uploadResults = await uploadMultipleImages(req.files, {
      folder: 'studio-rental/messages'
    });
    attachments = uploadResults.map(result => result.url);
  }

  const message = await createMessage(fromUserId, toUserId, content, bookingId, attachments, req.io);

  // Populate user info including avatar
  await message.populate('fromUserId', 'username fullName avatar');
  await message.populate('toUserId', 'username fullName avatar');

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
  const isBookingConversation = mongoose.Types.ObjectId.isValid(conversationId);

  let messages, total;

  if (isBookingConversation) {
    // Booking conversation - verify user is participant in the booking
    const booking = await Booking.findById(conversationId).select('userId');
    if (!booking) {
      const error = new Error('Booking không tồn tại');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is the booking owner
    if (booking.userId.toString() !== userId) {
      const error = new Error('Không có quyền truy cập cuộc hội thoại này');
      error.statusCode = 403;
      throw error;
    }

    [messages, total] = await Promise.all([
      Message.find({ bookingId: conversationId })
        .sort({ createdAt: -1 })
        .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 20))
        .limit(parseInt(limit) || 20)
        .populate('fromUserId', 'username fullName avatar')
        .populate('toUserId', 'username fullName avatar'),
      Message.countDocuments({ bookingId: conversationId })
    ]);
  } else {
    // Direct conversation (format: userId1-userId2)
    const [userId1, userId2] = conversationId.split('-');
    if (!userId1 || !userId2) {
      const error = new Error('Định dạng conversation ID không hợp lệ');
      error.statusCode = 400;
      throw error;
    }

    // Validate both userIds are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId1) || !mongoose.Types.ObjectId.isValid(userId2)) {
      const error = new Error('User ID không hợp lệ');
      error.statusCode = 400;
      throw error;
    }

    // Verify user is participant
    if (userId !== userId1 && userId !== userId2) {
      const error = new Error('Không có quyền xem cuộc hội thoại này');
      error.statusCode = 403;
      throw error;
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
        .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 20))
        .limit(parseInt(limit) || 20)
        .populate('fromUserId', 'username fullName avatar')
        .populate('toUserId', 'username fullName avatar'),
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

  // Populate user info including avatar
  await message.populate('fromUserId', 'username fullName avatar');
  await message.populate('toUserId', 'username fullName avatar');

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