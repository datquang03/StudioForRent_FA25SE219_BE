import mongoose from "mongoose";

/**
 * CANCELLATION POLICY MODEL
 * Thay thế Policy generic - structured policies
 * Theo PostgreSQL schema: cancellation_policies table
 */
const cancellationPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    hoursBeforeBooking: {
      type: Number,
      required: true,
      min: 0,
      // Số giờ trước booking (e.g., 24, 48, 72)
    },
    refundPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      // Phần trăm hoàn tiền (0-100%)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// Indexes
cancellationPolicySchema.index({ isActive: 1 });
cancellationPolicySchema.index({ hoursBeforeBooking: 1 });

const CancellationPolicy = mongoose.model("CancellationPolicy", cancellationPolicySchema);

export default CancellationPolicy;
