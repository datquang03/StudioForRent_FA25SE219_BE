import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    userCount: {
      type: Number,
      default: 0,
    },
    utilizationTrends: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
analyticsSchema.index({ date: 1 });

const Analytics = mongoose.model("Analytics", analyticsSchema);

export default Analytics;
