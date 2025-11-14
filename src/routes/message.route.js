// #region Imports
import express from 'express';
import {
  createMessageController,
  getConversationsController,
  getMessagesInConversationController,
  markMessageAsReadController,
  deleteMessageController,
} from '../controllers/message.controller.js';
import { protect } from '../middlewares/auth.js';
// #endregion

const router = express.Router();

// #region Message Routes

// Tất cả routes đều cần authentication
router.use(protect);

// Tạo message mới
router.post('/', createMessageController);

// Lấy danh sách conversations
router.get('/conversations', getConversationsController);

// Lấy messages trong conversation (booking hoặc direct)
router.get('/conversation/:conversationId', getMessagesInConversationController);

// Đánh dấu message đã đọc
router.put('/:id/read', markMessageAsReadController);

// Xóa message
router.delete('/:id', deleteMessageController);

// #endregion

export default router;