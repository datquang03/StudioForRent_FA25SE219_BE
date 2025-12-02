import mongoose from "mongoose";
import { Booking, Review, Studio } from "../models/index.js";
import { BOOKING_STATUS } from "../utils/constants.js";

export const createReview = async ({ userId, bookingId, rating, title, comment }) => {
  // Validate required fields
  if (!userId) {
    const err = new Error("ID người dùng là bắt buộc");
    err.status = 400;
    throw err;
  }

  if (!bookingId) {
    const err = new Error("ID booking là bắt buộc");
    err.status = 400;
    throw err;
  }

  if (!rating) {
    const err = new Error("Đánh giá là bắt buộc");
    err.status = 400;
    throw err;
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    const err = new Error("Đánh giá phải là số từ 1 đến 5");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error("ID người dùng không hợp lệ");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error("ID booking không hợp lệ");
    err.status = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId).populate("scheduleId");
  if (!booking) {
    const err = new Error("Booking không tồn tại");
    err.status = 404;
    throw err;
  }

  if (!booking.userId.equals(userId)) {
    const err = new Error("Không có quyền đánh giá booking này");
    err.status = 403;
    throw err;
  }

  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    const err = new Error("Chỉ có thể đánh giá booking đã hoàn thành");
    err.status = 400;
    throw err;
  }

  // Ensure one review per booking
  const existing = await Review.findOne({ bookingId });
  if (existing) {
    const err = new Error("Đánh giá cho booking này đã tồn tại");
    err.status = 409;
    throw err;
  }

  const schedule = booking.scheduleId || null;
  const studioId = schedule?.studioId || null;

  if (!studioId) {
    const err = new Error("Không tìm thấy studio cho booking này");
    err.status = 400;
    throw err;
  }

  const review = new Review({
    userId,
    bookingId,
    studioId,
    rating,
    title,
    comment,
  });

  await review.save();

  // Update studio aggregates using atomic operations to prevent race conditions
  if (studioId) {
    await Studio.findByIdAndUpdate(studioId, [
      {
        $set: {
          reviewCount: { $add: ['$reviewCount', 1] },
          avgRating: {
            $round: [
              {
                $divide: [
                  { $add: [{ $multiply: ['$avgRating', '$reviewCount'] }, rating] },
                  { $add: ['$reviewCount', 1] }
                ]
              },
              1
            ]
          }
        }
      }
    ]);
  }

  return review;
};

export const getReviewsByStudio = async ({ studioId, limit = 20, skip = 0 }) => {
  if (!studioId) {
    const err = new Error("ID studio là bắt buộc");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(studioId)) {
    const err = new Error("ID studio không hợp lệ");
    err.status = 400;
    throw err;
  }

  const query = { studioId };
  const reviews = await Review.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "userId", select: "fullName email" });

  return reviews;
};

export const getReviewByBooking = async ({ bookingId }) => {
  if (!bookingId) {
    const err = new Error("ID booking là bắt buộc");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error("ID booking không hợp lệ");
    err.status = 400;
    throw err;
  }

  return Review.findOne({ bookingId }).populate({ path: "userId", select: "fullName email" });
};
