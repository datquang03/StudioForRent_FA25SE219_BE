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
    inUseQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maintenanceQty: {
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Pre-save hook: Validate quantities only
equipmentSchema.pre('save', function(next) {
  // Validation: totalQty = availableQty + inUseQty + maintenanceQty
  const sum = this.availableQty + this.inUseQty + this.maintenanceQty;
  
  if (sum !== this.totalQty) {
    return next(new Error(`Equipment quantity mismatch: totalQty (${this.totalQty}) must equal availableQty (${this.availableQty}) + inUseQty (${this.inUseQty}) + maintenanceQty (${this.maintenanceQty}) = ${sum}`));
  }
  
  next();
});

// Indexes (status có thể query/filter được)
equipmentSchema.index({ status: 1 });
equipmentSchema.index({ availableQty: 1 });
equipmentSchema.index({ createdAt: -1 });
equipmentSchema.index({ isDeleted: 1 });

// Text index for search performance
equipmentSchema.index({ name: 'text', description: 'text' });

const Equipment = mongoose.model("Equipment", equipmentSchema);

export default Equipment;
