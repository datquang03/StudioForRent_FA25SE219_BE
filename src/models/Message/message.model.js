import mongoose from "mongoose";

/**
 * MESSAGE MODEL
 * Simplified - user-to-user messaging (theo PostgreSQL schema)
 */
const messageSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
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
messageSchema.index({ bookingId: 1 });
messageSchema.index({ toUserId: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
