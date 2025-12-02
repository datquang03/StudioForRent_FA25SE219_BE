import asyncHandler from "express-async-handler";
import * as reviewService from "../services/review.service.js";
import { isValidObjectId } from "../utils/validators.js";

export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { bookingId, rating, title, comment } = req.body;

  // Validate required fields
  if (!bookingId || !isValidObjectId(bookingId)) {
    return res.status(400).json({ success: false, message: "ID booking hợp lệ là bắt buộc" });
  }

  if (!rating) {
    return res.status(400).json({ success: false, message: "Đánh giá là bắt buộc" });
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "Đánh giá phải là số từ 1 đến 5" });
  }

  // Validate optional fields
  if (title && (typeof title !== 'string' || title.trim().length === 0 || title.length > 100)) {
    return res.status(400).json({ success: false, message: "Tiêu đề phải là chuỗi không rỗng với tối đa 100 ký tự" });
  }

  if (comment && (typeof comment !== 'string' || comment.trim().length === 0 || comment.length > 500)) {
    return res.status(400).json({ success: false, message: "Bình luận phải là chuỗi không rỗng với tối đa 500 ký tự" });
  }

  const review = await reviewService.createReview({ userId, bookingId, rating, title, comment });

  res.status(201).json({ success: true, data: review });
});

export const listReviewsByStudio = asyncHandler(async (req, res) => {
  const { studioId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = parseInt(req.query.skip, 10) || 0;

  // Validate studioId
  if (!studioId || !isValidObjectId(studioId)) {
    return res.status(400).json({ success: false, message: "ID studio hợp lệ là bắt buộc" });
  }

  // Validate pagination parameters
  if (limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: "Giới hạn phải từ 1 đến 100" });
  }

  if (skip < 0) {
    return res.status(400).json({ success: false, message: "Bỏ qua phải là số không âm" });
  }

  const reviews = await reviewService.getReviewsByStudio({ studioId, limit, skip });
  res.json({ success: true, data: reviews });
});

export const getReviewForBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Validate bookingId
  if (!bookingId || !isValidObjectId(bookingId)) {
    return res.status(400).json({ success: false, message: "ID booking hợp lệ là bắt buộc" });
  }

  const review = await reviewService.getReviewByBooking({ bookingId });
  if (!review) return res.status(404).json({ success: false, message: "Đánh giá không tồn tại" });
  res.json({ success: true, data: review });
});
