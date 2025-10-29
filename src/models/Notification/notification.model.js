import mongoose from "mongoose";
import { NOTIFICATION_TYPE } from "../../utils/constants.js";

/**
 * NOTIFICATION MODEL
 * Theo PostgreSQL schema với type và related_id
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      default: NOTIFICATION_TYPE.INFO,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      // booking_id, etc.
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
