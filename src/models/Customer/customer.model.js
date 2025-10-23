import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    
    // Customer-specific fields
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Example: { favoriteStudios: [], notificationSettings: {}, theme: 'light' }
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    
    // Additional fields from old User model
    avatarUrl: {
      type: String,
      default: "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg",
    },
    
    // Email verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
    },
    verificationCodeExpires: {
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

// Indexes (username và email đã có index từ unique: true)
customerSchema.index({ isBanned: 1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
