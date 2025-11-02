import mongoose from "mongoose";

/**
 * CUSTOMER PROFILE MODEL
 * Extended profile for customers (1-to-1 with User where role = 'customer')
 * Theo PostgreSQL schema: customer_profiles table
 */
const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    address: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Example: { favoriteStudios: [], notificationSettings: {}, theme: 'light' }
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes - userId đã có unique: true, không cần khai báo lại

const CustomerProfile = mongoose.model("CustomerProfile", customerProfileSchema);

export default CustomerProfile;
