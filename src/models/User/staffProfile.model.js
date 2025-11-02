import mongoose from "mongoose";
import { STAFF_POSITIONS } from "../../utils/constants.js";

/**
 * STAFF PROFILE MODEL
 * Extended profile for staff/admin (1-to-1 with User where role = 'staff' or 'admin')
 * Theo PostgreSQL schema: staff_profiles table
 */
const staffProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    position: {
      type: String,
      enum: Object.values(STAFF_POSITIONS),
      required: true,
    },
    hireDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes - userId đã có unique: true, chỉ giữ composite index
staffProfileSchema.index({ position: 1, isActive: 1 });

const StaffProfile = mongoose.model("StaffProfile", staffProfileSchema);

export default StaffProfile;
