import asyncHandler from "express-async-handler";
import {
  createCommentService,
  getCommentsService,
  replyToCommentService,
  deleteCommentService,
} from "../services/comment.service.js";

/**
 * Create a new question/comment
 * POST /api/comments
 */
export const createComment = asyncHandler(async (req, res) => {
  try {
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
    const result = await getCommentsService(req.query);
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
 * Delete a comment (Admin or Owner)
 * DELETE /api/comments/:id
 */
export const deleteComment = asyncHandler(async (req, res) => {
  try {
    await deleteCommentService(req.params.id, req.user._id, req.user.role);
    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    res.status(403); // Or 404 depending on error, but service throws generic Error
    throw new Error(error.message);
  }
});
