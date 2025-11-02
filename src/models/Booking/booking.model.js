import mongoose from "mongoose";
import { BOOKING_STATUS, PAY_TYPE } from "../../utils/constants.js";

/**
 * BOOKING MODEL
 * Theo PostgreSQL schema với price breakdown và payment type
 */
const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
      unique: true,
    },
    totalBeforeDiscount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    promoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
    },
    payType: {
      type: String,
      enum: Object.values(PAY_TYPE),
      default: PAY_TYPE.FULL,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
      required: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ scheduleId: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
