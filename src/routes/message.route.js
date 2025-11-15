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
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
// #endregion

const router = express.Router();

// #region Message Routes

// Apply middleware to all routes
router.use(sanitizeInput);
router.use(generalLimiter);
router.use(protect);

// Tạo message mới
router.post('/', createMessageController);

// Lấy danh sách conversations
router.get('/conversations', getConversationsController);

// Lấy messages trong conversation (booking hoặc direct)
router.get('/conversation/:conversationId', getMessagesInConversationController);

// Đánh dấu message đã đọc
router.put('/:id/read', validateObjectId(), markMessageAsReadController);

// Xóa message
router.delete('/:id', validateObjectId(), deleteMessageController);

// #endregion

export default router;