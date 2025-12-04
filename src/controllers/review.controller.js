import asyncHandler from "express-async-handler";
import { ValidationError } from "../utils/errors.js";
import {
  createReviewService,
  getReviewsService,
  replyToReviewService,
  updateReviewService,
  toggleReviewVisibilityService,
  updateReviewReplyService,
  toggleReviewLikeService,
} from "../services/review.service.js";

/**
 * Create a new review
 * POST /api/reviews
 */
export const createReview = asyncHandler(async (req, res) => {
  try {
    if (!req.body.content || req.body.content.trim().length === 0) {
      res.status(400);
      throw new Error("Nội dung đánh giá là bắt buộc");
    }
    const review = await createReviewService(req.body, req.user._id);
    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Get reviews for a specific target
 * GET /api/reviews?targetType=Studio&targetId=...
 */
export const getReviews = asyncHandler(async (req, res) => {
  try {
    const result = await getReviewsService(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Reply to a review (Staff/Admin only)
 * POST /api/reviews/:id/reply
 */
export const replyToReview = asyncHandler(async (req, res) => {
  if (!req.body.content || req.body.content.trim().length === 0) {
    throw new ValidationError("Nội dung phản hồi là bắt buộc");
  }
  const review = await replyToReviewService(req.params.id, req.body.content, req.user._id);
  res.status(200).json({
    success: true,
    data: review,
  });
});

/**
 * Update a review reply (Staff/Admin only)
 * PUT /api/reviews/:id/reply
 */
export const updateReviewReply = asyncHandler(async (req, res) => {
  if (!req.body.content || req.body.content.trim().length === 0) {
    throw new ValidationError("Nội dung phản hồi là bắt buộc");
  }
  const review = await updateReviewReplyService(req.params.id, req.body.content, req.user._id);
  res.status(200).json({
    success: true,
    data: review,
  });
});

/**
 * Update a review (Customer only)
 * PUT /api/reviews/:id
 */
export const updateReview = asyncHandler(async (req, res) => {
  try {
    if (req.body.content !== undefined && req.body.content.trim().length === 0) {
      res.status(400);
      throw new Error("Nội dung đánh giá không được để trống");
    }
    const review = await updateReviewService(req.params.id, req.body, req.user._id);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Toggle review visibility (Admin only)
 * PATCH /api/reviews/:id/visibility
 */
export const toggleReviewVisibility = asyncHandler(async (req, res) => {
  try {
    const review = await toggleReviewVisibilityService(req.params.id);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

/**
 * Toggle like on a review
 * POST /api/reviews/:id/like
 */
export const likeReview = asyncHandler(async (req, res) => {
  const review = await toggleReviewLikeService(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: review,
  });
});
