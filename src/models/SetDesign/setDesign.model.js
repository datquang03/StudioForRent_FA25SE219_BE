import mongoose from "mongoose";

const setDesignSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    userRequest: {
      type: String,
      required: true,
    },
    aiGeneratedImageUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "generated", "approved", "rejected", "implemented"],
      default: "pending",
      required: true,
    },
    staffNotes: {
      type: String,
    },
    approvedByUser: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
setDesignSchema.index({ bookingId: 1, status: 1 });

const SetDesign = mongoose.model("SetDesign", setDesignSchema);

export default SetDesign;
