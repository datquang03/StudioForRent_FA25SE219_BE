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
    area: {
      type: Number,
      min: 0,
      // Diện tích phòng (m²)
    },
    location: {
      type: String,
      // Vị trí: "Tầng 2, Tòa A" hoặc "Quận 1, TPHCM"
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
