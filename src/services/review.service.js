import mongoose from "mongoose";
import { Booking, Review, Studio } from "../models/index.js";
import { BOOKING_STATUS } from "../utils/constants.js";

export const createReview = async ({ userId, bookingId, rating, title, comment }) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error("Invalid bookingId");
    err.status = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId).populate("scheduleId");
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }

  if (!booking.userId.equals(userId)) {
    const err = new Error("Not allowed to review this booking");
    err.status = 403;
    throw err;
  }

  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    const err = new Error("Can only review completed bookings");
    err.status = 400;
    throw err;
  }

  // Ensure one review per booking
  const existing = await Review.findOne({ bookingId });
  if (existing) {
    const err = new Error("Review for this booking already exists");
    err.status = 409;
    throw err;
  }

  const schedule = booking.scheduleId || null;
  const studioId = schedule?.studioId || null;

  if (!studioId) {
    const err = new Error("Cannot find studio for this booking");
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
  if (!mongoose.Types.ObjectId.isValid(studioId)) {
    const err = new Error("Invalid studioId");
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
  return Review.findOne({ bookingId }).populate({ path: "userId", select: "fullName email" });
};
