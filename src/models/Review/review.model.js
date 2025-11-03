import mongoose from "mongoose";

/**
 * REVIEW MODEL
 * Theo PostgreSQL schema với images array
 */
const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
    },
    images: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
// bookingId đã có unique: true, không cần index riêng
reviewSchema.index({ userId: 1 });
reviewSchema.index({ rating: 1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
