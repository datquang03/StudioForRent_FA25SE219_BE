import Comment from "../models/Comment/comment.model.js";

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
 * @returns {Promise<Object>} Comments and pagination info
 */
export const getCommentsService = async (query) => {
  const { targetType, targetId, page = 1, limit = 10 } = query;

  if (!targetType || !targetId) {
    throw new Error("targetType and targetId are required");
  }

  const filter = { targetType, targetId, isHidden: false };

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

  await comment.deleteOne();
};
