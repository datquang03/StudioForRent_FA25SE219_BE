import asyncHandler from "express-async-handler";
import * as reviewService from "../services/review.service.js";

export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { bookingId, rating, title, comment } = req.body;

  if (!bookingId || !rating) {
    return res.status(400).json({ success: false, message: "bookingId and rating are required" });
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "rating must be a number between 1 and 5" });
  }

  const review = await reviewService.createReview({ userId, bookingId, rating, title, comment });

  res.status(201).json({ success: true, data: review });
});

export const listReviewsByStudio = asyncHandler(async (req, res) => {
  const { studioId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = parseInt(req.query.skip, 10) || 0;

  const reviews = await reviewService.getReviewsByStudio({ studioId, limit, skip });
  res.json({ success: true, data: reviews });
});

export const getReviewForBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const review = await reviewService.getReviewByBooking({ bookingId });
  if (!review) return res.status(404).json({ success: false, message: "Review not found" });
  res.json({ success: true, data: review });
});
