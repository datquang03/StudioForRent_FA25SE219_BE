import asyncHandler from "express-async-handler";
import {
  createReviewService,
  getReviewsService,
  replyToReviewService,
  updateReviewService,
  toggleReviewVisibilityService,
  updateReviewReplyService,
} from "../services/review.service.js";

/**
 * Create a new review
 * POST /api/reviews
 */
export const createReview = asyncHandler(async (req, res) => {
  try {
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
  try {
    const review = await replyToReviewService(req.params.id, req.body.content, req.user._id);
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
 * Update a review reply (Staff/Admin only)
 * PUT /api/reviews/:id/reply
 */
export const updateReviewReply = asyncHandler(async (req, res) => {
  try {
    const review = await updateReviewReplyService(req.params.id, req.body.content, req.user._id);
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
 * Update a review (Customer only)
 * PUT /api/reviews/:id
 */
export const updateReview = asyncHandler(async (req, res) => {
  try {
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
