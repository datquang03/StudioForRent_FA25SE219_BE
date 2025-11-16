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

    // Policy snapshots (immutable copy of policies at booking time)
    policySnapshots: {
      cancellation: {
        type: mongoose.Schema.Types.Mixed, // Full policy object snapshot
      },
      noShow: {
        type: mongoose.Schema.Types.Mixed, // Full policy object snapshot
      }
    },

    // Event tracking for policy applications
    events: [{
      type: {
        type: String,
        enum: ['CANCELLED', 'NO_SHOW', 'REFUND_PROCESSED', 'CHARGE_APPLIED'],
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now,
        required: true
      },
      details: {
        type: mongoose.Schema.Types.Mixed, // Flexible details object
      },
      amount: {
        type: Number,
        default: 0
      }
    }],

    // Financial tracking for policy applications
    financials: {
      originalAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      refundAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      chargeAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      netAmount: {
        type: Number,
        default: 0
      }
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
// scheduleId đã có unique: true, không cần index riêng

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
