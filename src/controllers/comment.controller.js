import asyncHandler from "express-async-handler";
import {
  createCommentService,
  getCommentsService,
  replyToCommentService,
  updateCommentService,
  deleteCommentService,
} from "../services/comment.service.js";

/**
 * Create a new question/comment
 * POST /api/comments
 */
export const createComment = asyncHandler(async (req, res) => {
  try {
    if (!req.body.content || req.body.content.trim().length === 0) {
      res.status(400);
      throw new Error("Nội dung bình luận là bắt buộc");
    }
    const comment = await createCommentService(req.body, req.user._id);
    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Get comments for a target (Q&A list)
 * GET /api/comments?targetType=Studio&targetId=...
 */
export const getComments = asyncHandler(async (req, res) => {
  try {
    const result = await getCommentsService(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result.comments,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Reply to a comment (Authenticated Users)
 * POST /api/comments/:id/reply
 */
export const replyToComment = asyncHandler(async (req, res) => {
  try {
    if (!req.body.content || req.body.content.trim().length === 0) {
      res.status(400);
      throw new Error("Nội dung phản hồi là bắt buộc");
    }
    const comment = await replyToCommentService(
      req.params.id,
      req.body.content,
      req.user._id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Update a comment (Owner only)
 * PUT /api/comments/:id
 */
export const updateComment = asyncHandler(async (req, res) => {
  try {
    if (!req.body.content || req.body.content.trim().length === 0) {
      res.status(400);
      throw new Error("Nội dung bình luận là bắt buộc");
    }
    const comment = await updateCommentService(req.params.id, req.body.content, req.user._id);
    res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Delete a comment (Admin, Staff or Owner)
 * DELETE /api/comments/:id
 */
export const deleteComment = asyncHandler(async (req, res) => {
  await deleteCommentService(req.params.id, req.user._id, req.user.role);
  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});
