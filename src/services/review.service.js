import mongoose from "mongoose";
import Review from "../models/Review/review.model.js";
import Booking from "../models/Booking/booking.model.js";
import Studio from "../models/Studio/studio.model.js";
import SetDesign from "../models/SetDesign/setDesign.model.js";
import Service from "../models/Service/service.model.js";
import { REVIEW_TARGET_TYPES } from "../utils/constants.js";

/**
 * Create a new review
 * @param {Object} data - Review data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created review
 */
export const createReviewService = async (data, userId) => {
  const { bookingId, targetType, targetId, rating, content, images } = data;

  // 1. Validate Booking
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) {
    throw new Error("Booking not found or does not belong to you.");
  }

  if (booking.status !== "completed") {
    throw new Error("You can only review completed bookings.");
  }

  // 2. Check if already reviewed
  const existingReview = await Review.findOne({ bookingId, targetId });
  if (existingReview) {
    throw new Error("You have already reviewed this item for this booking.");
  }

  // 3. Create Review
  const review = await Review.create({
    bookingId,
    userId,
    targetType,
    targetId,
    rating,
    content,
    images,
  });

  // 4. Update Average Rating (Async)
  await updateAverageRating(targetType, targetId);

  return review;
};

/**
 * Get reviews for a specific target
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Reviews and pagination info
 */
export const getReviewsService = async (query) => {
  const { targetType, targetId, page = 1, limit = 10 } = query;

  if (!targetType || !targetId) {
    throw new Error("targetType and targetId are required");
  }

  const filter = { targetType, targetId, isHidden: false };

  const reviews = await Review.find(filter)
    .populate("userId", "fullName avatar")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Review.countDocuments(filter);

  return {
    reviews,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Reply to a review
 * @param {string} reviewId - Review ID
 * @param {string} content - Reply content
 * @param {string} userId - Staff/Admin ID
 * @returns {Promise<Object>} Updated review
 */
export const replyToReviewService = async (reviewId, content, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error("Review not found");
  }

  review.reply = {
    userId,
    content,
    createdAt: new Date(),
  };

  await review.save();
  return review;
};

/**
 * Helper function to recalculate average rating
 * @param {string} targetType - Target type
 * @param {string} targetId - Target ID
 */
const updateAverageRating = async (targetType, targetId) => {
  const stats = await Review.aggregate([
    { $match: { targetType, targetId: new mongoose.Types.ObjectId(targetId) } },
    {
      $group: {
        _id: "$targetId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    const { avgRating, count } = stats[0];
    const roundedRating = Math.round(avgRating * 10) / 10;

    if (targetType === REVIEW_TARGET_TYPES.STUDIO) {
      await Studio.findByIdAndUpdate(targetId, { avgRating: roundedRating, reviewCount: count });
    } else if (targetType === REVIEW_TARGET_TYPES.SET_DESIGN) {
      await SetDesign.findByIdAndUpdate(targetId, { ratingAvg: roundedRating, reviewCount: count });
    } else if (targetType === REVIEW_TARGET_TYPES.SERVICE) {
      await Service.findByIdAndUpdate(targetId, { avgRating: roundedRating, reviewCount: count });
    }
  }
};
