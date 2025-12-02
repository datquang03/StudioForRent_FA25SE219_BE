import Comment from "../models/Comment/comment.model.js";
import { createAndSendNotification } from "./notification.service.js";
import { NOTIFICATION_TYPE } from "../utils/constants.js";

/**
 * Create a new comment
 * @param {Object} data - Comment data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created comment
 */
export const createCommentService = async (data, userId) => {
  const { targetType, targetId, content } = data;

  const comment = await Comment.create({
    userId,
    targetType,
    targetId,
    content,
  });

  return comment;
};

/**
 * Get comments for a target
 * @param {Object} query - Query parameters
 * @param {Object} user - User object (optional)
 * @returns {Promise<Object>} Comments and pagination info
 */
export const getCommentsService = async (query, user) => {
  const { targetType, targetId, page = 1, limit = 10 } = query;

  if (!targetType || !targetId) {
    throw new Error("targetType and targetId are required");
  }

  const filter = { targetType, targetId };

  // Only show hidden comments if user is NOT staff/admin
  const isStaffOrAdmin = user && (user.role === "staff" || user.role === "admin");
  if (!isStaffOrAdmin) {
    filter.isHidden = false;
  }

  const comments = await Comment.find(filter)
    .populate("userId", "fullName avatar")
    .populate("replies.userId", "fullName avatar role")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Comment.countDocuments(filter);

  return {
    comments,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Reply to a comment
 * @param {string} commentId - Comment ID
 * @param {string} content - Reply content
 * @param {string} userId - Staff/Admin ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Updated comment
 */
export const replyToCommentService = async (commentId, content, userId, userRole) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error("Comment not found");
  }

  comment.replies.push({
    userId,
    userRole,
    content,
    createdAt: new Date(),
  });

  await comment.save();

  // Send notification to the comment owner if the replier is NOT the owner
  if (comment.userId.toString() !== userId.toString()) {
    await createAndSendNotification(
      comment.userId,
      NOTIFICATION_TYPE.REPLY_COMMENT,
      "Có phản hồi mới cho bình luận của bạn",
      `Ai đó đã trả lời bình luận của bạn: "${content.substring(0, 50)}..."`,
      false, // No email for now to avoid spam, or true if critical
      null, // io instance passed from controller if needed, but service doesn't have it usually. 
            // Ideally controller should handle io, or we pass io to service.
            // For now, let's assume notification service handles socket if io is globally available or passed.
            // The current notification service signature is (userId, type, title, message, sendEmail, io, relatedId)
      comment._id
    );
  }

  return comment;
};

/**
 * Update a comment (Owner only)
 * @param {string} commentId - Comment ID
 * @param {string} content - New content
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated comment
 */
export const updateCommentService = async (commentId, content, userId) => {
  const comment = await Comment.findOne({ _id: commentId, userId });
  if (!comment) {
    throw new Error("Comment not found or you are not authorized to update it");
  }

  comment.content = content;
  await comment.save();
  return comment;
};

/**
 * Delete a comment
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<void>}
 */
export const deleteCommentService = async (commentId, userId, userRole) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error("Comment not found");
  }

  // Allow deletion if user is admin, staff, or the owner of the comment
  if (userRole !== "admin" && userRole !== "staff" && comment.userId.toString() !== userId.toString()) {
    throw new Error("Not authorized to delete this comment");
  }

  // Soft delete if there are replies, hard delete otherwise
  if (comment.replies && comment.replies.length > 0) {
    comment.content = "Comment has been deleted";
    // Optionally mark as deleted flag if schema supports it, but content replacement is standard for threaded discussions
    await comment.save();
  } else {
    await comment.deleteOne();
  }
};
