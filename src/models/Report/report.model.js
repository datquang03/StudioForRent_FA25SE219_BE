import mongoose from "mongoose";
import { REPORT_STATUS, REPORT_ISSUE_TYPE } from "../../utils/constants.js";

/**
 * REPORT MODEL
 * Theo PostgreSQL schema với issue_type và resolution tracking
 */
const reportSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
reportSchema.index({ bookingId: 1 });
reportSchema.index({ reporterId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ issueType: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
