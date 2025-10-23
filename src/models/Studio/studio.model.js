import mongoose from "mongoose";

const studioSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    location: {
      type: String,
    },
    availability: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
studioSchema.index({ type: 1, isApproved: 1 });

const Studio = mongoose.model("Studio", studioSchema);

export default Studio;
