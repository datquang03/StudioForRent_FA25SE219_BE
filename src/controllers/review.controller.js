import asyncHandler from "express-async-handler";
import {
  createReviewService,
  getReviewsService,
  replyToReviewService,
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
    const result = await getReviewsService(req.query);
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
