// #region Imports
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import CustomDesignRequest from '../models/CustomDesignRequest/customDesignRequest.model.js';
import logger from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
import axios from 'axios';
import { generateImageWithGetty } from './gettyImages.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { SET_DESIGN_CATEGORIES } from '../utils/constants.js';
// #endregion

// #region Helper Functions

/**
 * Validate ObjectId format and presence
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {ValidationError} If ID is invalid or missing
 */
const validateObjectId = (id, fieldName) => {
  if (!id) {
    throw new ValidationError(`${fieldName} là bắt buộc`);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} không hợp lệ`);
  }
};

// #endregion

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.9,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  },
});

// Gemini Imagen 3 is already initialized through genAI above

// #region Set Design Service - Product Catalog

/**
 * Get all active set designs with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.category - Filter by category
 * @param {string} options.search - Search in name and description
 * @param {string} options.sortBy - Sort field (default: createdAt)
 * @param {string} options.sortOrder - Sort order (default: desc)
 * @returns {Object} Paginated set designs
 */
export const getSetDesigns = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = { isActive: true };

    // Add category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [designs, total] = await Promise.all([
      SetDesign.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('reviews.customerId', 'name email')
        .populate('comments.customerId', 'name email')
        .populate('comments.replies.userId', 'name email'),
      SetDesign.countDocuments(query)
    ]);

    return {
      designs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting set designs:', error);
    throw new Error('Failed to retrieve set designs');
  }
};

/**
 * Get a single set design by ID
 * @param {string} id - Set design ID
 * @returns {Object} Set design with populated reviews and comments
 */
export const getSetDesignById = async (id) => {
  try {
    validateObjectId(id, 'ID set design');

    const design = await SetDesign.findById(id)
      .populate('reviews.customerId', 'name email')
      .populate('comments.customerId', 'name email')
      .populate('comments.replies.userId', 'name email');

    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    return design;
  } catch (error) {
    logger.error('Error getting set design by ID:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin set design');
  }
};

/**
 * Create a new set design (Admin only)
 * @param {Object} designData - Set design data
 * @returns {Object} Created set design
 */
export const createSetDesign = async (designData, user) => {
  try {
    // Only staff can create set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể tạo set design');
    }

    // Validate required fields
    if (!designData.name || !designData.description) {
      throw new ValidationError('Tên và mô tả là bắt buộc');
    }

    // Validate price
    if (designData.price !== undefined && (isNaN(designData.price) || designData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Validate category
    if (designData.category && !SET_DESIGN_CATEGORIES.includes(designData.category)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    const design = new SetDesign(designData);
    await design.save();
    logger.info(`New set design created: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error creating set design:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo set design');
  }
};

/**
 * Update a set design (Admin only)
 * @param {string} id - Set design ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated set design
 */
export const updateSetDesign = async (id, updateData, user) => {
  try {
    // Only staff can update set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể cập nhật set design');
    }

    validateObjectId(id, 'ID set design');

    // Validate price if provided
    if (updateData.price !== undefined && (isNaN(updateData.price) || updateData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Validate category if provided
    if (updateData.category && !SET_DESIGN_CATEGORIES.includes(updateData.category)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    const design = await SetDesign.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    
    logger.info(`Set design updated: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error updating set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật set design');
  }
};

/**
 * Delete a set design (Admin only) - Soft delete by setting isActive to false
 * @param {string} id - Set design ID
 * @returns {Object} Deleted set design
 */
export const deleteSetDesign = async (id, user) => {
  try {
    // Only staff can delete set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể xóa set design');
    }

    validateObjectId(id, 'ID set design');

    const design = await SetDesign.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    
    logger.info(`Set design deactivated: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error deleting set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa set design');
  }
};

/**
 * Add a review to a set design
 * @param {string} designId - Set design ID
 * @param {string} customerId - Customer ID
 * @param {string} customerName - Customer name
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Review comment
 * @returns {Object} Updated set design
 */
export const addReview = async (designId, customerId, customerName, rating, comment) => {
  try {
    validateObjectId(designId, 'ID set design');
    validateObjectId(customerId, 'ID khách hàng');
    if (!rating || !comment) {
      throw new ValidationError('Rating và nội dung đánh giá là bắt buộc');
    }
    if (isNaN(rating) || rating < 1 || rating > 5) {
      throw new ValidationError('Rating phải từ 1 đến 5');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    await design.addReview(customerId, customerName, rating, comment);

    logger.info(`Review added to set design: ${design.name} by customer: ${customerId}`);
    return design;
  } catch (error) {
    logger.error('Error adding review:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi thêm đánh giá');
  }
};

/**
 * Add a comment to a set design
 * @param {string} designId - Set design ID
 * @param {string} customerId - Customer ID
 * @param {string} customerName - Customer name
 * @param {string} message - Comment message
 * @returns {Object} Updated set design
 */
export const addComment = async (designId, customerId, customerName, message) => {
  try {
    // Validate designId
    validateObjectId(designId, 'ID set design');

    // Validate customerId
    validateObjectId(customerId, 'ID khách hàng');

    // Validate customerName
    if (!customerName || customerName.trim().length === 0) {
      throw new ValidationError('Tên khách hàng là bắt buộc');
    }

    // Validate message
    if (!message) {
      throw new ValidationError('Nội dung bình luận là bắt buộc');
    }
    if (typeof message !== 'string') {
      throw new ValidationError('Nội dung bình luận phải là chuỗi');
    }
    if (message.trim().length === 0) {
      throw new ValidationError('Nội dung bình luận không được để trống');
    }
    if (message.length > 300) {
      throw new ValidationError('Nội dung bình luẫn không được vượt quá 300 ký tự');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (!design.isActive) {
      throw new ValidationError('Không thể bình luận trên set design đã bị vô hiệu hóa');
    }

    await design.addComment(customerId, customerName, message);

    logger.info(`Comment added to set design: ${design.name} by customer: ${customerId}`);
    return design;
  } catch (error) {
    logger.error('Error adding comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    if (error.name === 'CastError') {
      throw new ValidationError('ID không hợp lệ');
    }
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message);
    }
    throw new Error('Lỗi khi thêm bình luận');
  }
};

/**
 * Reply to a comment on a set design (Staff and Customer)
 * @param {string} designId - Set design ID
 * @param {number} commentIndex - Index of the comment to reply to
 * @param {string} userId - User ID (staff or customer)
 * @param {string} userName - User name
 * @param {string} userRole - User role (customer, staff, admin)
 * @param {string} message - Reply message
 * @returns {Object} Updated set design
 */
export const replyToComment = async (designId, commentIndex, userId, userName, userRole, message) => {
  try {
    // Validate designId
    validateObjectId(designId, 'ID set design');

    // Validate commentIndex
    if (commentIndex === undefined || commentIndex === null) {
      throw new ValidationError('Chỉ số bình luận là bắt buộc');
    }
    if (!Number.isInteger(commentIndex) || commentIndex < 0) {
      throw new ValidationError('Chỉ số bình luận không hợp lệ');
    }

    // Validate userId
    validateObjectId(userId, 'ID người dùng');

    // Validate userName
    if (!userName || userName.trim().length === 0) {
      throw new ValidationError('Tên người dùng là bắt buộc');
    }

    // Validate userRole
    if (!userRole || !['customer', 'staff', 'admin'].includes(userRole)) {
      throw new ValidationError('Vai trò người dùng không hợp lệ');
    }

    // Validate message
    if (!message) {
      throw new ValidationError('Nội dung phản hồi là bắt buộc');
    }
    if (typeof message !== 'string') {
      throw new ValidationError('Nội dung phản hồi phải là chuỗi');
    }
    if (message.trim().length === 0) {
      throw new ValidationError('Nội dung phản hồi không được để trống');
    }
    if (message.length > 300) {
      throw new ValidationError('Nội dung phản hồi không được vượt quá 300 ký tự');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (!design.isActive) {
      throw new ValidationError('Không thể phản hồi trên set design đã bị vô hiệu hóa');
    }

    if (commentIndex >= design.comments.length) {
      throw new ValidationError('Bình luận không tồn tại');
    }

    await design.replyToComment(commentIndex, userId, userName, userRole, message);

    logger.info(`Reply added to comment on set design: ${design.name} by user: ${userId}`);
    return design;
  } catch (error) {
    logger.error('Error replying to comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    if (error.name === 'CastError') {
      throw new ValidationError('ID không hợp lệ');
    }
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message);
    }
    throw new Error('Lỗi khi thêm phản hồi');
  }
};

/**
 * Update a comment on a set design
 * @param {string} designId - Set design ID
 * @param {number} commentIndex - Index of the comment
 * @param {string} customerId - Customer ID (for ownership verification)
 * @param {string} newMessage - New message content
 * @returns {Object} Updated set design
 */
export const updateComment = async (designId, commentIndex, customerId, newMessage) => {
  try {
    // Validate designId
    validateObjectId(designId, 'ID set design');

    // Validate commentIndex
    if (commentIndex === undefined || commentIndex === null) {
      throw new ValidationError('Chỉ số bình luận là bắt buộc');
    }
    if (!Number.isInteger(commentIndex) || commentIndex < 0) {
      throw new ValidationError('Chỉ số bình luận không hợp lệ');
    }

    // Validate customerId
    validateObjectId(customerId, 'ID khách hàng');

    // Validate newMessage
    if (!newMessage) {
      throw new ValidationError('Nội dung bình luận mới là bắt buộc');
    }
    if (typeof newMessage !== 'string') {
      throw new ValidationError('Nội dung bình luận phải là chuỗi');
    }
    if (newMessage.trim().length === 0) {
      throw new ValidationError('Nội dung bình luận không được để trống');
    }
    if (newMessage.length > 300) {
      throw new ValidationError('Nội dung bình luẫn không được vượt quá 300 ký tự');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (commentIndex >= design.comments.length) {
      throw new ValidationError('Bình luận không tồn tại');
    }

    // Verify ownership
    if (design.comments[commentIndex].customerId.toString() !== customerId.toString()) {
      throw new ValidationError('Bạn không có quyền chỉnh sửa bình luận này');
    }

    await design.updateComment(commentIndex, newMessage);

    logger.info(`Comment updated on set design: ${design.name} by customer: ${customerId}`);
    return design;
  } catch (error) {
    logger.error('Error updating comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    if (error.name === 'CastError') {
      throw new ValidationError('ID không hợp lệ');
    }
    throw new Error('Lỗi khi cập nhật bình luận');
  }
};

/**
 * Delete a comment on a set design
 * @param {string} designId - Set design ID
 * @param {number} commentIndex - Index of the comment
 * @param {string} userId - User ID (customer or staff/admin)
 * @param {string} userRole - User role
 * @returns {Object} Updated set design
 */
export const deleteComment = async (designId, commentIndex, userId, userRole) => {
  try {
    validateObjectId(designId, 'ID set design');
    validateObjectId(userId, 'ID người dùng');

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (commentIndex < 0 || commentIndex >= design.comments.length) {
      throw new ValidationError('Bình luận không tồn tại');
    }

    // Verify ownership or admin/staff role
    const isOwner = design.comments[commentIndex].customerId.toString() === userId.toString();
    const isStaffOrAdmin = userRole === 'staff' || userRole === 'admin';
    
    if (!isOwner && !isStaffOrAdmin) {
      throw new ValidationError('Bạn không có quyền xóa bình luận này');
    }

    await design.deleteComment(commentIndex);

    logger.info(`Comment deleted from set design: ${design.name} by user: ${userId}`);
    return design;
  } catch (error) {
    logger.error('Error deleting comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa bình luận');
  }
};

/**
 * Update a reply on a comment
 * @param {string} designId - Set design ID
 * @param {number} commentIndex - Index of the comment
 * @param {number} replyIndex - Index of the reply
 * @param {string} userId - User ID (for ownership verification)
 * @param {string} newMessage - New message content
 * @returns {Object} Updated set design
 */
export const updateReply = async (designId, commentIndex, replyIndex, userId, newMessage) => {
  try {
    validateObjectId(designId, 'ID set design');
    if (commentIndex === undefined || commentIndex === null) {
      throw new ValidationError('Chỉ số bình luận là bắt buộc');
    }
    if (replyIndex === undefined || replyIndex === null) {
      throw new ValidationError('Chỉ số phản hồi là bắt buộc');
    }
    validateObjectId(userId, 'ID người dùng');
    if (!newMessage || newMessage.trim().length === 0) {
      throw new ValidationError('Nội dung phản hồi mới là bắt buộc');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (commentIndex < 0 || commentIndex >= design.comments.length) {
      throw new ValidationError('Bình luận không tồn tại');
    }

    const comment = design.comments[commentIndex];
    if (replyIndex < 0 || replyIndex >= comment.replies.length) {
      throw new ValidationError('Phản hồi không tồn tại');
    }

    // Verify ownership
    if (comment.replies[replyIndex].userId.toString() !== userId.toString()) {
      throw new ValidationError('Bạn không có quyền chỉnh sửa phản hồi này');
    }

    await design.updateReply(commentIndex, replyIndex, newMessage);

    logger.info(`Reply updated on set design: ${design.name} by user: ${userId}`);
    return design;
  } catch (error) {
    logger.error('Error updating reply:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật phản hồi');
  }
};

/**
 * Delete a reply on a comment
 * @param {string} designId - Set design ID
 * @param {number} commentIndex - Index of the comment
 * @param {number} replyIndex - Index of the reply
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Object} Updated set design
 */
export const deleteReply = async (designId, commentIndex, replyIndex, userId, userRole) => {
  try {
    validateObjectId(designId, 'ID set design');
    if (commentIndex === undefined || commentIndex === null) {
      throw new ValidationError('Chỉ số bình luận là bắt buộc');
    }
    if (replyIndex === undefined || replyIndex === null) {
      throw new ValidationError('Chỉ số phản hồi là bắt buộc');
    }
    if (!userId) {
      throw new ValidationError('ID người dùng là bắt buộc');
    }

    const design = await SetDesign.findById(designId);
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (commentIndex < 0 || commentIndex >= design.comments.length) {
      throw new ValidationError('Bình luận không tồn tại');
    }

    const comment = design.comments[commentIndex];
    if (replyIndex < 0 || replyIndex >= comment.replies.length) {
      throw new ValidationError('Phản hồi không tồn tại');
    }

    // Verify ownership or admin/staff role
    const isOwner = comment.replies[replyIndex].userId.toString() === userId.toString();
    const isStaffOrAdmin = userRole === 'staff' || userRole === 'admin';
    
    if (!isOwner && !isStaffOrAdmin) {
      throw new ValidationError('Bạn không có quyền xóa phản hồi này');
    }

    await design.deleteReply(commentIndex, replyIndex);

    logger.info(`Reply deleted from set design: ${design.name} by user: ${userId}`);
    return design;
  } catch (error) {
    logger.error('Error deleting reply:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa phản hồi');
  }
};

/**
 * Like a comment on a set design
 * @param {string} commentId - Comment ObjectId (_id from MongoDB)
 * @param {string} userId - User ID who is liking
 * @returns {Object} Updated comment with likes
 */
export const likeComment = async (commentId, userId) => {
  try {
    // Validate inputs
    if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
      throw new ValidationError('ID bình luận là bắt buộc');
    }
    validateObjectId(commentId, 'ID bình luận');
    validateObjectId(userId, 'ID người dùng');

    // Find design that contains this comment
    const design = await SetDesign.findOne({ 'comments._id': commentId });
    if (!design) {
      throw new NotFoundError('Bình luận không tồn tại');
    }
    if (!design.isActive) {
      throw new ValidationError('Set design đã bị vô hiệu hóa');
    }

    // Find comment
    const comment = design.comments.id(commentId);
    if (!comment) {
      throw new NotFoundError('Bình luận không tồn tại');
    }

    // Check if user already liked
    const alreadyLiked = comment.likes.some(id => id.toString() === userId.toString());
    if (alreadyLiked) {
      throw new ValidationError('Bạn đã thích bình luận này rồi');
    }

    // Add like
    comment.likes.push(userId);
    await design.save();

    logger.info(`Comment ${commentId} liked by user ${userId}`);
    return {
      commentId,
      likes: comment.likes,
      likesCount: comment.likes.length
    };
  } catch (error) {
    logger.error('Error liking comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    if (error.name === 'CastError') {
      throw new ValidationError('ID không hợp lệ');
    }
    throw new Error('Lỗi khi thích bình luận');
  }
};

/**
 * Unlike a comment on a set design
 * @param {string} commentId - Comment ObjectId (_id from MongoDB)
 * @param {string} userId - User ID who is unliking
 * @returns {Object} Updated comment with likes
 */
export const unlikeComment = async (commentId, userId) => {
  try {
    // Validate inputs
    if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
      throw new ValidationError('ID bình luận là bắt buộc');
    }
    validateObjectId(commentId, 'ID bình luận');
    validateObjectId(userId, 'ID người dùng');

    // Find design that contains this comment
    const design = await SetDesign.findOne({ 'comments._id': commentId });
    if (!design) {
      throw new NotFoundError('Bình luận không tồn tại');
    }

    // Find comment
    const comment = design.comments.id(commentId);
    if (!comment) {
      throw new NotFoundError('Bình luận không tồn tại');
    }

    // Check if user has liked
    const likeIndex = comment.likes.findIndex(id => id.toString() === userId.toString());
    if (likeIndex === -1) {
      throw new ValidationError('Bạn chưa thích bình luận này');
    }

    // Remove like
    comment.likes.splice(likeIndex, 1);
    await design.save();

    logger.info(`Comment ${commentId} unliked by user ${userId}`);
    return {
      commentId,
      likes: comment.likes,
      likesCount: comment.likes.length
    };
  } catch (error) {
    logger.error('Error unliking comment:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    if (error.name === 'CastError') {
      throw new ValidationError('ID không hợp lệ');
    }
    throw new Error('Lỗi khi bỏ thích bình luận');
  }
};

/**
 * Upload an image to Cloudinary for a set design
 * @param {string} base64Image - Base64 encoded image
 * @param {string} fileName - File name for the image
 * @returns {string} Cloudinary URL of the uploaded image
 */
export const uploadDesignImage = async (base64Image, fileName = 'design') => {
  try {
    if (!base64Image || base64Image.trim().length === 0) {
      throw new ValidationError('Ảnh base64 là bắt buộc');
    }

    // Validate base64 format
    if (!base64Image.includes('base64')) {
      throw new ValidationError('Định dạng ảnh base64 không hợp lệ');
    }

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(`data:image/png;base64,${base64Data}`, {
      folder: 'set-designs',
      public_id: `${fileName}-${Date.now()}`,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    });

    logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading image to Cloudinary:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tải lên ảnh');
  }
};

/**
 * Get set designs by category
 * @param {string} category - Category to filter by
 * @returns {Array} Array of set designs in the category
 */
export const getSetDesignsByCategory = async (category) => {
  try {
    return await SetDesign.getByCategory(category);
  } catch (error) {
    logger.error('Error getting set designs by category:', error);
    throw new Error('Failed to retrieve set designs by category');
  }
};

/**
 * Get active set designs (for homepage/catalog)
 * @returns {Array} Array of active set designs
 */
export const getActiveSetDesigns = async () => {
  try {
    return await SetDesign.getActiveDesigns();
  } catch (error) {
    logger.error('Error getting active set designs:', error);
    throw new Error('Failed to retrieve active set designs');
  }
};

// #endregion

// #region AI Design Consultation & Image Generation

/**
 * Chat with AI about design ideas and get suggestions
 * @param {string} userMessage - User's question or request about design
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Object} AI response with design suggestions
 */
export const chatWithDesignAI = async (userMessage, conversationHistory = []) => {
  try {
    logger.info('Processing design consultation chat');

    const systemPrompt = `You are an expert studio photography set designer and creative consultant. Your role is to:

1. Help customers brainstorm creative ideas for their photoshoot set designs
2. Suggest specific props, backdrops, lighting setups, and color schemes
3. Provide professional advice on composition and atmosphere
4. Ask clarifying questions to understand their vision better
5. Recommend styles that match their needs (wedding, portrait, corporate, etc.)

Always be:
- Creative and inspiring
- Practical and feasible
- Professional and helpful
- Detailed with specific suggestions

Focus on studio photography set designs WITHOUT people in the frame.`;

    // Build conversation context
    let conversationText = `${systemPrompt}\n\n`;
    
    if (conversationHistory.length > 0) {
      conversationText += 'Previous conversation:\n';
      conversationHistory.forEach((msg) => {
        conversationText += `${msg.role === 'user' ? 'Customer' : 'Designer'}: ${msg.content}\n`;
      });
      conversationText += '\n';
    }

    conversationText += `Customer: ${userMessage}\n\nPlease provide helpful design suggestions:`;

    const result = await textModel.generateContent([conversationText]);
    const response = await result.response;
    const aiMessage = response.text();

    logger.info('Design consultation response generated');

    return {
      success: true,
      userMessage,
      aiResponse: aiMessage,
      timestamp: new Date().toISOString(),
      conversationLength: conversationHistory.length + 1
    };
  } catch (error) {
    logger.error('Error in design consultation chat:', error);
    throw new Error('Failed to process design consultation');
  }
};

/**
 * Generate design summary and image prompt from conversation
 * @param {Array} conversationHistory - Full conversation history
 * @returns {Object} Design summary and optimized prompt
 */
export const generateDesignSummaryFromChat = async (conversationHistory) => {
  try {
    logger.info('Generating design summary from conversation');

    const conversationText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Customer' : 'Designer'}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Based on the following conversation about a studio photography set design, create a comprehensive summary and an optimized prompt for AI image generation.

Conversation:
${conversationText}

Provide your response in this exact JSON format:
{
  "designSummary": "A brief summary of the agreed design concept",
  "keyElements": ["element1", "element2", "element3"],
  "style": "overall style (e.g., vintage, modern, minimalist)",
  "colorScheme": "main colors",
  "mood": "desired atmosphere",
  "imagePrompt": "A detailed, optimized prompt for DALL-E 3 image generation focusing on the studio set design"
}`;

    const result = await textModel.generateContent([summaryPrompt]);
    const response = await result.response;
    let summaryText = response.text();

    // Extract JSON from response
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      summaryText = jsonMatch[0];
    }

    const designSummary = JSON.parse(summaryText);

    logger.info('Design summary generated successfully');

    return {
      success: true,
      ...designSummary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error generating design summary:', error);
    throw new Error('Failed to generate design summary');
  }
};

/**
 * Generate actual image using DALL-E 3 from OpenAI
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Object} Generated image data
 */
export const generateImageWithDALLE = async (prompt, options = {}) => {
  try {
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to .env file');
    }

    logger.info('Generating image with DALL-E 3');

    const {
      size = '1024x1024', // Options: 1024x1024, 1024x1792, 1792x1024
      quality = 'hd', // Options: standard, hd
      style = 'vivid' // Options: vivid, natural
    } = options;

    // Enhance prompt for studio photography
    const enhancedPrompt = `Professional studio photography set design: ${prompt}. 
High-quality, photorealistic, well-lit professional photography setup. 
No people in the frame, focus on the set design, props, and equipment. 
Studio lighting visible, clean composition, magazine-quality image.`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt.substring(0, 4000), // DALL-E 3 limit
      n: 1,
      size,
      quality,
      style,
      response_format: 'url'
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    logger.info('Image generated successfully with DALL-E 3');

    // Download image and upload to Cloudinary for permanent storage
    const cloudinaryUrl = await downloadAndUploadToCloudinary(imageUrl, 'ai-generated-design');

    return {
      success: true,
      imageUrl: cloudinaryUrl,
      originalUrl: imageUrl,
      revisedPrompt,
      metadata: {
        model: 'dall-e-3',
        size,
        quality,
        style,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Error generating image with DALL-E:', error);
    if (error.message.includes('API key')) {
      throw error;
    }
    throw new Error('Failed to generate image with DALL-E 3');
  }
};

/**
 * Download image from URL and upload to Cloudinary
 * @param {string} imageUrl - Source image URL
 * @param {string} fileName - File name prefix
 * @returns {string} Cloudinary URL
 */
const downloadAndUploadToCloudinary = async (imageUrl, fileName) => {
  try {
    // Download image as buffer
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${base64Image}`,
      {
        folder: 'ai-generated-designs',
        public_id: `${fileName}-${Date.now()}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      }
    );

    logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Complete workflow: Chat → Design Summary → Generate Image
 * @param {Array} conversationHistory - Full conversation
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Complete result with summary and image
 */
export const generateCompleteDesign = async (conversationHistory, imageOptions = {}) => {
  try {
    logger.info('Starting complete design generation workflow');

    // Step 1: Generate design summary from conversation
    const summary = await generateDesignSummaryFromChat(conversationHistory);

    // Step 2: Generate image using the optimized prompt
    const imageResult = await generateImageWithDALLE(summary.imagePrompt, imageOptions);

    // Combine results
    return {
      success: true,
      designSummary: {
        description: summary.designSummary,
        keyElements: summary.keyElements,
        style: summary.style,
        colorScheme: summary.colorScheme,
        mood: summary.mood
      },
      image: {
        url: imageResult.imageUrl,
        revisedPrompt: imageResult.revisedPrompt,
        metadata: imageResult.metadata
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error in complete design generation:', error);
    throw new Error('Failed to generate complete design');
  }
};

// #endregion

// #region Custom Design Requests - AI Image Generation

/**
 * Generate enhanced prompt for image generation from text description
 * RESTRICTED: Only for studio photography set design
 * @param {string} description - Text description of the desired set design
 * @returns {string} Enhanced prompt for image generation
 */
export const generateEnhancedPrompt = async (description) => {
  try {
    logger.info('Generating enhanced image prompt for studio set design using Gemini AI');

    const promptEnhancementRequest = `You are an expert in creating detailed prompts for AI image generation tools specialized in STUDIO PHOTOGRAPHY SET DESIGN.

User's description: "${description}"

Create a highly detailed, professional prompt SPECIFICALLY for generating a PHOTOGRAPHY STUDIO SET DESIGN image. The prompt MUST:

IMPORTANT REQUIREMENTS:
- This is for a PHOTOGRAPHY STUDIO SET DESIGN only (not portraits, products, or other subjects)
- Focus on the PHYSICAL SPACE and SETUP of a photography studio
- Include studio equipment, lighting setups, backdrops, and props

The prompt should:
1. Specify the type of photography studio (portrait, product, fashion, newborn, wedding, etc.)
2. Detail the backdrop/background (color, material, texture)
3. Describe lighting equipment and setup (softboxes, reflectors, natural light, etc.)
4. List props and decorative elements relevant to the studio type
5. Mention studio layout and spatial arrangement
6. Include technical photography terms
7. Specify colors, materials, and textures
8. Describe the overall mood and aesthetic
9. Be optimized for photorealistic results
10. NO PEOPLE in the image - empty studio set only

STUDIO CONTEXT: This is for a studio rental service, so the image should show an attractive, professional photography set that customers would want to rent.

Return ONLY the enhanced prompt text, nothing else. Make it detailed but concise (max 250 words).`;

    const result = await textModel.generateContent([promptEnhancementRequest]);
    const response = await result.response;
    const enhancedPrompt = response.text();

    logger.info('Enhanced studio set design prompt generated successfully');
    return enhancedPrompt.trim();
  } catch (error) {
    logger.error('Error generating enhanced prompt, using fallback:', error.message);
    
    // FALLBACK: Rule-based prompt enhancement (no API needed)
    const enhancedPrompt = generateFallbackPrompt(description);
    logger.info('Using fallback prompt enhancement (no AI)');
    return enhancedPrompt;
  }
};

/**
 * Generate enhanced prompt without AI (fallback for quota issues)
 * @param {string} description - Original description
 * @returns {string} Enhanced prompt
 */
const generateFallbackPrompt = (description) => {
  const desc = description.toLowerCase();
  
  // Detect studio type
  let studioType = 'photography';
  if (desc.includes('portrait') || desc.includes('chân dung')) studioType = 'portrait photography';
  else if (desc.includes('product') || desc.includes('sản phẩm')) studioType = 'product photography';
  else if (desc.includes('wedding') || desc.includes('cưới')) studioType = 'wedding photography';
  else if (desc.includes('newborn') || desc.includes('em bé')) studioType = 'newborn photography';
  else if (desc.includes('fashion')) studioType = 'fashion photography';
  
  // Detect style
  let style = 'modern';
  if (desc.includes('vintage') || desc.includes('cổ điển')) style = 'vintage';
  else if (desc.includes('minimalist') || desc.includes('tối giản')) style = 'minimalist';
  else if (desc.includes('luxury') || desc.includes('sang trọng')) style = 'luxury';
  
  // Detect colors
  let colors = 'neutral tones';
  if (desc.includes('white') || desc.includes('trắng')) colors = 'white';
  if (desc.includes('pastel')) colors = 'pastel colors';
  if (desc.includes('dark') || desc.includes('tối')) colors = 'dark tones';
  
  // Build enhanced prompt
  return `Professional ${studioType} studio set design: ${description}. 
  
Empty studio space featuring:
- ${style} aesthetic with ${colors}
- Professional lighting equipment (softboxes, reflectors, key lights)
- High-quality backdrop or seamless paper background
- Carefully arranged props and decorative elements
- Clean, well-organized studio layout
- Modern professional photography equipment visible
- Photorealistic quality, 8K resolution
- Architectural photography perspective
- No people in the scene - empty studio ready for photoshoot
- Inviting atmosphere perfect for a studio rental service`.trim();
};

/**
 * Generate AI image from text description using Gemini Imagen 3
 * NOTE: Gemini Imagen has strict free tier limits. This function will:
 * 1. Try to generate with Gemini Imagen (if quota available)
 * 2. Fallback to enhanced prompt only (if quota exceeded)
 * 
 * @param {string} description - Text description of the desired set design
 * @param {Object} options - Generation options
 * @returns {Object} Image generation result with URL or enhanced prompt
 */
export const generateImageFromText = async (description, options = {}) => {
  try {
    logger.info('Processing text-to-image request');

    const {
      provider = 'getty', // Changed default to Getty Images
      model = 'gemini-2.5-flash-image',
      aspectRatio = '16:9',
      imageSize = '1K',
      numberOfImages = 1,
      negativePrompt = '',
      responseModalities = ['IMAGE'],
      useGoogleSearch = false,
      enableActualGeneration = true,
    } = options;

    // Getty Images Generation (Primary Provider)
    if (provider === 'getty') {
      logger.info('Using Getty Images AI Generation');

      try {
        const gettyOptions = {
          aspectRatio,
          numberOfImages,
          negativePrompt: negativePrompt || 'blurry, low quality, distorted, unprofessional'
        };

        const result = await generateImageWithGetty(description, gettyOptions);

        if (!result.success) {
          throw new Error(result.error || 'Getty Images generation failed');
        }

        logger.info('Getty Images generation successful');

        return {
          success: true,
          mode: 'full-generation',
          provider: 'getty',
          url: result.url,
          originalDescription: description,
          enhancedPrompt: description,
          metadata: {
            ...result.metadata,
            aspectRatio,
            numberOfImages,
            timestamp: new Date().toISOString()
          }
        };

      } catch (gettyError) {
        logger.error('Getty Images generation failed:', gettyError);

        // Fallback to Gemini if Getty fails
        if (options.allowFallback !== false) {
          logger.info('Falling back to Gemini Imagen');
          return generateImageFromText(description, { 
            ...options, 
            provider: 'gemini',
            allowFallback: false // Prevent infinite fallback loop
          });
        }

        throw gettyError;
      }
    }

    // Gemini Imagen Generation (Fallback Provider)
    if (provider === 'gemini') {
      logger.info('Using Gemini Imagen');

      // Generate enhanced prompt using Gemini text model
      const enhancedPrompt = await generateEnhancedPrompt(description);

      // If actual image generation is disabled or not available, return enhanced prompt only
      if (!enableActualGeneration) {
        logger.info('Returning enhanced prompt only (actual generation disabled)');
        
        return {
          success: true,
          mode: 'prompt-only',
          provider: 'gemini',
          originalDescription: description,
          enhancedPrompt: enhancedPrompt,
          metadata: {
            aspectRatio: aspectRatio,
            imageSize: imageSize,
            timestamp: new Date().toISOString()
          },
          instructions: {
            message: 'Enhanced prompt generated successfully. Use with external image generation service.',
            recommendedServices: [
              'Getty Images AI (Primary - Commercial License)',
              'Gemini Imagen (requires paid API key)',
              'DALL-E 3 (OpenAI)',
              'Midjourney',
              'Stable Diffusion XL'
            ],
            prompt: enhancedPrompt,
            note: 'To enable automatic image generation, upgrade to paid Gemini API or use Getty Images.'
          }
        };
      }

      // Try to generate with Gemini Imagen
      try {
        logger.info('Attempting to generate image with Gemini Imagen');

        const imageModel = genAI.getGenerativeModel({
          model: model,
        });

        const generationConfig = {
          responseModalities: responseModalities,
        };

        if (aspectRatio || imageSize) {
          generationConfig.imageConfig = {};
          if (aspectRatio) generationConfig.imageConfig.aspectRatio = aspectRatio;
          if (imageSize && model === 'gemini-3-pro-image-preview') {
            generationConfig.imageConfig.imageSize = imageSize;
          }
        }

        if (useGoogleSearch && model === 'gemini-3-pro-image-preview') {
          generationConfig.tools = [{ google_search: {} }];
        }

        const result = await imageModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          generationConfig: generationConfig,
        });

        const response = result.response;

        // Extract image data
        let imageData = null;
        let imageText = null;

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
            imageData = part.inlineData;
          }
          if (part.text) {
            imageText = part.text;
          }
        }

        if (!imageData) {
          throw new Error('No image generated in response');
        }

        // Upload to Cloudinary
        const base64Image = `data:${imageData.mimeType};base64,${imageData.data}`;
        const cloudinaryResult = await cloudinary.uploader.upload(base64Image, {
          folder: 'ai-generated-designs',
          resource_type: 'image',
        });

        logger.info('Image generated and uploaded successfully');

        return {
          success: true,
          mode: 'full-generation',
          provider: 'gemini',
          url: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id,
          description: imageText || enhancedPrompt,
          originalDescription: description,
          enhancedPrompt: enhancedPrompt,
          metadata: {
            model: model,
            aspectRatio: aspectRatio,
            imageSize: imageSize,
            mimeType: imageData.mimeType,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            format: cloudinaryResult.format,
            bytes: cloudinaryResult.bytes,
            timestamp: new Date().toISOString()
          }
        };

      } catch (imageGenError) {
        // Check if it's a quota error
        if (imageGenError.message && imageGenError.message.includes('quota')) {
          logger.warn('Gemini Imagen quota exceeded, falling back to prompt-only mode');
          
          return {
            success: true,
            mode: 'prompt-only',
            provider: 'gemini',
            originalDescription: description,
            enhancedPrompt: enhancedPrompt,
            metadata: {
              aspectRatio: aspectRatio,
              imageSize: imageSize,
              timestamp: new Date().toISOString()
            },
            quotaInfo: {
              exceeded: true,
              message: 'Gemini Imagen free tier quota exceeded',
              recommendation: 'Use Getty Images or upgrade to paid API key'
            },
            instructions: {
              message: 'Enhanced prompt generated. Actual image generation unavailable due to quota limits.',
              recommendedServices: [
                'Getty Images AI (Recommended - Commercial License)',
                'DALL-E 3 (OpenAI) - Best quality',
                'Midjourney - Artistic styles',
                'Stable Diffusion XL - Open source'
              ],
              prompt: enhancedPrompt
            }
          };
        }
        
        // Other errors, throw
        throw imageGenError;
      }
    }

    // Invalid provider
    throw new Error(`Invalid provider: ${provider}. Supported providers: getty, gemini`);

  } catch (error) {
    logger.error('Error in text-to-image processing:', error);
    throw new Error(`Failed to process text-to-image request: ${error.message}`);
  }
};

/**
 * Get custom design requests for a customer by contact info
 * @param {Object} filters
 * @param {string} filters.email - Customer email
 * @param {string} [filters.phoneNumber] - Phone number for extra verification
 * @param {string} [filters.status] - Request status filter
 * @param {number} [filters.page] - Page number
 * @param {number} [filters.limit] - Page size
 */
export const getCustomSetDesign = async (filters = {}) => {
  try {
    const {
      email,
      phoneNumber,
      status,
      page = 1,
      limit = 10
    } = filters;

    if (!email) {
      throw new ValidationError('Email là bắt buộc');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new ValidationError('Email không hợp lệ');
    }

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const query = { email: normalizedEmail };

    if (phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\s/g, '');
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(normalizedPhone)) {
        throw new ValidationError('Số điện thoại không hợp lệ');
      }
      query.phoneNumber = normalizedPhone;
    }

    if (status) {
      const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
      query.status = status;
    }

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CustomDesignRequest.countDocuments(query)
    ]);

    return {
      requests,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error getting customer custom design requests:', error);
    throw new Error('Lỗi khi lấy yêu cầu thiết kế tùy chỉnh');
  }
};

/**
 * Create a custom design request with AI-generated image
 * @param {Object} requestData - Customer request data
 * @returns {Object} Created custom design request
 */
export const createCustomDesignRequest = async (requestData) => {
  try {
    const {
      customerName,
      email,
      phoneNumber,
      description,
      referenceImages = [],
      preferredCategory,
      budgetRange
    } = requestData;

    // Validate required fields
    if (!customerName || !email || !phoneNumber || !description) {
      throw new ValidationError('Tên khách hàng, email, số điện thoại và mô tả là bắt buộc');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Email không hợp lệ');
    }

    // Validate phone number format (Vietnamese)
    const phoneRegex = /^(0|\+84)(\s|\.)?((3[2-9])|(5[689])|(7[06-9])|(8[1-689])|(9[0-46-9]))(\d)(\s|\.)?(\d{3})(\s|\.)?(\d{3})$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      throw new ValidationError('Số điện thoại không hợp lệ');
    }

    // Validate category if provided
    if (preferredCategory && !SET_DESIGN_CATEGORIES.includes(preferredCategory)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    logger.info(`Creating custom design request for ${email}`);

    // Create the request with pending status
    const customRequest = new CustomDesignRequest({
      customerName,
      email,
      phoneNumber,
      description,
      referenceImages,
      preferredCategory,
      budgetRange,
      status: 'pending',
      aiGenerationAttempts: 0
    });

    await customRequest.save();

    logger.info(`Custom design request created: ${customRequest._id}`);

    // Attempt to generate AI image asynchronously (don't block the request)
    // We'll update the request with the image later
    generateAndAttachAIImage(customRequest._id, description).catch(err => {
      logger.error(`Failed to generate AI image for request ${customRequest._id}:`, err);
    });

    return customRequest;
  } catch (error) {
    logger.error('Error creating custom design request:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo yêu cầu thiết kế tùy chỉnh');
  }
};

/**
 * Generate AI image and attach to existing request (async background task)
 * @param {string} requestId - Custom design request ID
 * @param {string} description - Design description
 */
const generateAndAttachAIImage = async (requestId, description) => {
  try {
    const request = await CustomDesignRequest.findById(requestId);
    if (!request) return;

    // Update status to processing
    request.status = 'processing';
    request.aiGenerationAttempts += 1;
    await request.save();

    // Generate image using Gemini Imagen
    const imageResult = await generateImageFromText(description, {
      model: 'gemini-2.5-flash-image',
      aspectRatio: '16:9',
    });
    
    // Update request with generated image
    request.generatedImage = imageResult.url;
    request.status = 'pending'; // Back to pending for staff review
    request.aiMetadata = {
      prompt: imageResult.enhancedPrompt,
      model: imageResult.metadata.model,
      generatedAt: imageResult.metadata.timestamp,
    };
    await request.save();

    logger.info(`AI image generated successfully for request ${requestId}`);

  } catch (error) {
    logger.error(`Error in generateAndAttachAIImage for ${requestId}:`, error);
    // Update request to show generation failed
    const request = await CustomDesignRequest.findById(requestId);
    if (request) {
      request.status = 'pending'; // Keep as pending for manual processing
      await request.save();
    }
  }
};

/**
 * Get all custom design requests with pagination
 * @param {Object} options - Query options
 * @returns {Object} Paginated custom design requests
 */
export const getCustomDesignRequests = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search
    } = options;

    const query = {};

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(query)
        .populate('processedBy', 'name email')
        .populate('convertedToDesignId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CustomDesignRequest.countDocuments(query)
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting custom design requests:', error);
    throw new Error('Failed to retrieve custom design requests');
  }
};

/**
 * Get a single custom design request by ID
 * @param {string} id - Request ID
 * @returns {Object} Custom design request
 */
export const getCustomDesignRequestById = async (id) => {
  try {
    const request = await CustomDesignRequest.findById(id)
      .populate('processedBy', 'name email')
      .populate('convertedToDesignId', 'name price images');

    if (!request) {
      throw new Error('Custom design request not found');
    }

    return request;
  } catch (error) {
    logger.error('Error getting custom design request:', error);
    throw new Error('Failed to retrieve custom design request');
  }
};

/**
 * Update custom design request status (Staff only)
 * @param {string} id - Request ID
 * @param {string} status - New status
 * @param {string} staffId - Staff member ID
 * @param {Object} updateData - Additional update data
 * @returns {Object} Updated request
 */
export const updateCustomDesignRequestStatus = async (id, status, staffId, updateData = {}) => {
  try {
    const request = await CustomDesignRequest.findById(id);
    if (!request) {
      throw new Error('Custom design request not found');
    }

    request.status = status;
    request.processedBy = staffId;

    if (updateData.staffNotes) request.staffNotes = updateData.staffNotes;
    if (updateData.estimatedPrice) request.estimatedPrice = updateData.estimatedPrice;

    await request.save();

    logger.info(`Custom design request ${id} updated to status: ${status}`);
    return request;
  } catch (error) {
    logger.error('Error updating custom design request:', error);
    throw new Error('Failed to update custom design request');
  }
};

/**
 * Convert approved custom request to actual SetDesign product
 * @param {string} requestId - Custom design request ID
 * @param {Object} designData - Additional design data
 * @returns {Object} Created SetDesign
 */
export const convertRequestToSetDesign = async (requestId, designData = {}, user) => {
  try {
    // Only staff can convert requests
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể chuyển đổi yêu cầu thành set design');
    }

    if (!requestId) {
      throw new ValidationError('ID yêu cầu là bắt buộc');
    }

    const request = await CustomDesignRequest.findById(requestId);
    if (!request) {
      throw new NotFoundError('Yêu cầu thiết kế tùy chỉnh không tồn tại');
    }
    if (request.status !== 'completed') {
      throw new ValidationError('Chỉ có thể chuyển đổi yêu cầu đã hoàn thành');
    }
    if (request.convertedToDesignId) {
      throw new ValidationError('Yêu cầu này đã được chuyển đổi thành set design rồi');
    }

    // Validate price if provided
    if (designData.price !== undefined && (isNaN(designData.price) || designData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Create SetDesign from request
    const setDesign = new SetDesign({
      name: designData.name || `Custom Design - ${request.customerName}`,
      description: request.description,
      price: request.estimatedPrice || designData.price || 0,
      images: [
        ...(request.generatedImage ? [request.generatedImage] : []),
        ...request.referenceImages,
        ...(designData.additionalImages || [])
      ],
      category: request.preferredCategory || 'other',
      tags: ['custom', ...(designData.tags || [])],
      isActive: designData.isActive !== undefined ? designData.isActive : true,
      createdBy: user._id
    });
    await setDesign.save();
    
    // Update request with conversion info
    request.convertedToDesignId = setDesign._id;
    await request.save();
    
    logger.info(`Custom design request ${requestId} converted to SetDesign ${setDesign._id} by user: ${user._id}`);
    return setDesign;
  } catch (error) {
    logger.error('Error converting request to set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi chuyển đổi yêu cầu thành set design');
  }
};

// #endregion