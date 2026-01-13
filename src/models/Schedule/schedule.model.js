import mongoose from "mongoose";
import { SCHEDULE_STATUS } from "../../utils/constants.js";

/**
 * SCHEDULE MODEL
 * Quản lý time slots của studio
 * Theo PostgreSQL schema: schedules table
 */
const scheduleSchema = new mongoose.Schema(
  {
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.startTime;
        },
        message: "endTime must be greater than startTime",
      },
    },
    status: {
      type: String,
      enum: Object.values(SCHEDULE_STATUS),
      default: SCHEDULE_STATUS.AVAILABLE,
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      // Note: unique constraint removed - multiple schedules can be available (bookingId = null)
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
scheduleSchema.index({ studioId: 1, startTime: 1, status: 1 });
scheduleSchema.index({ studioId: 1, status: 1 }, { partialFilterExpression: { status: SCHEDULE_STATUS.AVAILABLE } });
// bookingId đã có unique: true, không cần index riêng

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
