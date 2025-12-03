import mongoose from "mongoose";
import { REVIEW_TARGET_TYPES } from "../../utils/constants.js";

/**
 * REVIEW MODEL (Centralized)
 * Hệ thống đánh giá tập trung cho Studio, SetDesign và Service.
 * BẮT BUỘC phải gắn liền với một Booking đã hoàn thành.
 */
const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Polymorphic Association
    targetType: {
      type: String,
      enum: Object.values(REVIEW_TARGET_TYPES), 
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [1000, "Đánh giá không được quá 1000 ký tự"],
    },
    images: {
      type: [String], // URL ảnh thực tế khách upload
      default: [],
    },
    
    // Phản hồi từ phía Studio/Staff (Cảm ơn hoặc giải trình)
    reply: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: String,
      createdAt: Date
    },

    // Likes/Reactions
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],

    isHidden: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

// Index để lấy review của 1 đối tượng nhanh chóng
reviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// Index để đảm bảo tính duy nhất: 1 Booking chỉ được review 1 lần cho 1 targetId cụ thể
reviewSchema.index({ bookingId: 1, targetId: 1, targetType: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
