import mongoose from "mongoose";

/**
 * ROOM POLICY MODEL
 * Chính sách hủy phòng/studio - structured policies
 * Theo PostgreSQL schema: room_policies table
 */
const roomPolicySchema = new mongoose.Schema(
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
roomPolicySchema.index({ isActive: 1 });
roomPolicySchema.index({ hoursBeforeBooking: 1 });

const RoomPolicy = mongoose.model("RoomPolicy", roomPolicySchema);

export default RoomPolicy;
