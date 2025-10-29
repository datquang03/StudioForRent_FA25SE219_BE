import mongoose from "mongoose";

/**
 * SERVICE MODEL (Extra Services)
 * Theo PostgreSQL schema: extra_services table
 */
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
serviceSchema.index({ isActive: 1 });

const Service = mongoose.model("Service", serviceSchema);

export default Service;
