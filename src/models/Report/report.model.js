import mongoose from "mongoose";
import { REPORT_STATUS, REPORT_ISSUE_TYPE, REPORT_TARGET_TYPES } from "../../utils/constants.js";

/**
 * REPORT MODEL
 * Polymorphic report model for Booking, Review, Comment
 */
const reportSchema = new mongoose.Schema(
  {
    // Polymorphic Association
    targetType: {
      type: String,
      enum: Object.values(REPORT_TARGET_TYPES),
      default: REPORT_TARGET_TYPES.BOOKING, // Default for backward compatibility
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
    },
    // Legacy field support (optional now)
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issueType: {
      type: String,
      enum: Object.values(REPORT_ISSUE_TYPE),
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.PENDING,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    compensationAmount: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporterId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ issueType: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
