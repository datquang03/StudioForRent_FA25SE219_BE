import mongoose from "mongoose";
import { USER_ROLES } from "../../utils/constants.js";

/**
 * UNIFIED USER MODEL
 * Thay thế Account và Customer models - tất cả users trong 1 collection
 * Theo PostgreSQL schema: users table
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Email verification (cho customers)
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
    },
    verificationCodeExpiry: {
      type: Date,
    },
    
    // Activity tracking
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes - Chỉ giữ composite index (username, email, phone đã có unique: true)
userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model("User", userSchema);

export default User;
