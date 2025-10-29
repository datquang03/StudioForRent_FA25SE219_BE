import mongoose from "mongoose";
import { REFUND_STATUS } from "../../utils/constants.js";

/**
 * REFUND MODEL
 * Updated để tham chiếu User thay vì Account
 */
const refundSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      default: REFUND_STATUS.PENDING,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Changed from Account to User
    },
    approvalNotes: {
      type: String,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
refundSchema.index({ status: 1 });
refundSchema.index({ bookingId: 1, status: 1 });
refundSchema.index({ approvedBy: 1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
