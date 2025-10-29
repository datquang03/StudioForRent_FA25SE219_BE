import mongoose from "mongoose";
import { STUDIO_STATUS } from "../../utils/constants.js";

const studioSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    basePricePerHour: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    capacity: {
      type: Number,
      default: 10,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(STUDIO_STATUS),
      default: STUDIO_STATUS.ACTIVE,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
studioSchema.index({ status: 1 });

const Studio = mongoose.model("Studio", studioSchema);

export default Studio;
