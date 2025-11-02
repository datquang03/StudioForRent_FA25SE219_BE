import mongoose from "mongoose";
import { EQUIPMENT_STATUS } from "../../utils/constants.js";

/**
 * EQUIPMENT MODEL
 * Global equipment pool (không thuộc studio cụ thể)
 * Theo PostgreSQL schema với inventory tracking
 */
const equipmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    pricePerHour: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    availableQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(EQUIPMENT_STATUS),
      default: EQUIPMENT_STATUS.AVAILABLE,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Validation: availableQty không được vượt quá totalQty
equipmentSchema.pre('save', function(next) {
  if (this.availableQty > this.totalQty) {
    next(new Error('availableQty cannot exceed totalQty'));
  }
  next();
});

// Indexes
equipmentSchema.index({ status: 1 });
equipmentSchema.index({ availableQty: 1 });

const Equipment = mongoose.model("Equipment", equipmentSchema);

export default Equipment;
