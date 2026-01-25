import mongoose from "mongoose";
import Review from "../models/Review/review.model.js";
import Booking from "../models/Booking/booking.model.js";
import Studio from "../models/Studio/studio.model.js";
import SetDesign from "../models/SetDesign/setDesign.model.js";
import Service from "../models/Service/service.model.js";
import User from "../models/User/user.model.js";
import { REVIEW_TARGET_TYPES, NOTIFICATION_TYPE, BOOKING_STATUS } from "../utils/constants.js";
import { createAndSendNotification } from "./notification.service.js";

/**
 * Create a new review
 * @param {Object} data - Review data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created review
 */
export const createReviewService = async (data, userId) => {
  const { rating, content, images } = data;
  const bookingId = data.bookingId || data.booking_id;
  const targetType = data.targetType || data.target_type;
  const targetId = data.targetId || data.target_id;

  // 0. Input Validation
  if (!bookingId) throw new Error("Mã booking là bắt buộc");
  if (!targetType || !targetId) throw new Error("Thông tin đối tượng đánh giá (targetId, targetType) là bắt buộc");
  if (!rating || rating < 1 || rating > 5) throw new Error("Đánh giá phải từ 1 đến 5 sao");

  // 1. Validate Booking
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) {
    throw new Error("Booking không tồn tại hoặc không thuộc về bạn.");
  }

  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new Error("Bạn chỉ có thể đánh giá các booking đã hoàn thành.");
  }

  // 2. Check if already reviewed
  const existingReview = await Review.findOne({ bookingId, targetId });
  if (existingReview) {
    throw new Error("Bạn đã đánh giá dịch vụ này cho booking này rồi.");
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

  // 5. Notify Admin/Staff (Async)
  // Find admins to notify
  const admins = await User.find({ role: "admin" }).select("_id");
  await Promise.all(admins.map(admin => 
    createAndSendNotification(
      admin._id,
      NOTIFICATION_TYPE.NEW_REVIEW,
      "Đánh giá mới",
      `Có đánh giá mới ${rating} sao cho ${targetType}`,
      false,
      null,
      review._id
    )
  ));

  return review;
};

/**
 * Get reviews for a specific target with advanced filtering and sorting
 * @param {Object} query - Query parameters
 * @param {Object} user - User object (optional)
 * @returns {Promise<Object>} Reviews and pagination info
 */
export const getReviewsService = async (query, user) => {
  const { 
    page = 1, 
    limit = 10,
    sortBy = 'newest', // newest, oldest, rating_desc, rating_asc
    hasImages,
    rating
  } = query;

  const targetType = query.targetType || query.target_type;
  const targetId = query.targetId || query.target_id;

  const filter = {};
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.targetId = targetId;

  // Only show hidden reviews if user is NOT staff/admin
  const isStaffOrAdmin = user && (user.role === "staff" || user.role === "admin");
  if (!isStaffOrAdmin) {
    filter.isHidden = false;
  }

  // Filter by rating
  if (rating) {
    filter.rating = Number(rating);
  }

  // Filter by images
  if (hasImages === 'true') {
    filter.images = { $exists: true, $not: { $size: 0 } };
  }

  // Sorting logic
  let sort = { createdAt: -1 }; // Default newest
  if (sortBy === 'oldest') {
    sort = { createdAt: 1 };
  } else if (sortBy === 'rating_desc') {
    sort = { rating: -1 };
  } else if (sortBy === 'rating_asc') {
    sort = { rating: 1 };
  }

  const reviews = await Review.find(filter)
    .populate("userId", "fullName avatar")
    .sort(sort)
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
 * Get reviews created by a specific user (My Reviews)
 * @param {string} userId - User ID
 * @param {Object} query - Query parameters (page, limit, sortBy)
 * @returns {Promise<Object>} Reviews and pagination info
 */
export const getMyReviewsService = async (userId, query) => {
  const { 
    page = 1, 
    limit = 10,
    sortBy = 'newest'
  } = query;

  const filter = { userId };

  // Sorting logic
  let sort = { createdAt: -1 }; // Default newest
  if (sortBy === 'oldest') {
    sort = { createdAt: 1 };
  } else if (sortBy === 'rating_desc') {
    sort = { rating: -1 };
  } else if (sortBy === 'rating_asc') {
    sort = { rating: 1 };
  }

  const reviews = await Review.find(filter)
    .populate("targetId", "name images") // Dynamic populate based on refPath
    .sort(sort)
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
    throw new Error("Đánh giá không tồn tại");
  }

  review.reply = {
    userId,
    content,
    createdAt: new Date(),
  };

  await review.save();

  // Notify the reviewer
  await createAndSendNotification(
    review.userId,
    NOTIFICATION_TYPE.REPLY_REVIEW,
    "Phản hồi đánh giá",
    `Studio đã phản hồi đánh giá của bạn: "${content.substring(0, 50)}..."`,
    true, // Send email for review replies as it's important
    null,
    review._id
  );

  return review;
};

/**
 * Update a review reply (Staff/Admin only)
 * @param {string} reviewId - Review ID
 * @param {string} content - New reply content
 * @param {string} userId - Staff/Admin ID
 * @returns {Promise<Object>} Updated review
 */
export const updateReviewReplyService = async (reviewId, content, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error("Đánh giá không tồn tại");
  }

  if (!review.reply) {
    throw new Error("Đánh giá này chưa có phản hồi để cập nhật");
  }

  // Optional: Check if the user updating is the one who replied or is an admin
  // For now, allow any staff/admin to update for flexibility

  review.reply.content = content;
  
  await review.save();
  return review;
};

/**
 * Update a review (Customer only)
 * @param {string} reviewId - Review ID
 * @param {Object} updateData - Data to update (rating, content, images)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated review
 */
export const updateReviewService = async (reviewId, updateData, userId) => {
  const review = await Review.findOne({ _id: reviewId, userId });
  if (!review) {
    throw new Error("Đánh giá không tồn tại hoặc bạn không có quyền cập nhật");
  }

  const { rating, content, images } = updateData;

  if (rating) review.rating = rating;
  if (content) review.content = content;
  if (images) review.images = images;

  await review.save();

  // Recalculate average rating if rating changed
  if (rating) {
    await updateAverageRating(review.targetType, review.targetId);
  }

  return review;
};

/**
 * Toggle review visibility (Admin only)
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} Updated review
 */
export const toggleReviewVisibilityService = async (reviewId) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error("Đánh giá không tồn tại");
  }

  review.isHidden = !review.isHidden;
  await review.save();
  return review;
};

/**
 * Toggle like on a review
 * @param {string} reviewId - Review ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated review
 */
export const toggleReviewLikeService = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error("Đánh giá không tồn tại");
  }

  const likeIndex = review.likes.indexOf(userId);
  if (likeIndex === -1) {
    // Like
    review.likes.push(userId);
    
    // Notify owner if not self-like
    if (review.userId.toString() !== userId.toString()) {
      await createAndSendNotification(
        review.userId,
        NOTIFICATION_TYPE.INFO,
        "Lượt thích mới",
        "Ai đó đã thích đánh giá của bạn.",
        false,
        null,
        review._id
      );
    }
  } else {
    // Unlike
    review.likes.splice(likeIndex, 1);
  }

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
    { $match: { targetType, targetId: new mongoose.Types.ObjectId(targetId), isHidden: false } },
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
      await SetDesign.findByIdAndUpdate(targetId, { avgRating: roundedRating, reviewCount: count });
    } else if (targetType === REVIEW_TARGET_TYPES.SERVICE) {
      await Service.findByIdAndUpdate(targetId, { avgRating: roundedRating, reviewCount: count });
    }
  } else {
    // If no reviews left (e.g. all hidden), reset to 0
    if (targetType === REVIEW_TARGET_TYPES.STUDIO) {
      await Studio.findByIdAndUpdate(targetId, { avgRating: 0, reviewCount: 0 });
    } else if (targetType === REVIEW_TARGET_TYPES.SET_DESIGN) {
      await SetDesign.findByIdAndUpdate(targetId, { avgRating: 0, reviewCount: 0 });
    } else if (targetType === REVIEW_TARGET_TYPES.SERVICE) {
      await Service.findByIdAndUpdate(targetId, { avgRating: 0, reviewCount: 0 });
    }
  }
};
