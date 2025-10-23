import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
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
    
    // Account-specific fields (Staff & Admin only)
    role: {
      type: String,
      enum: ["staff", "admin"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Additional fields
    avatarUrl: {
      type: String,
      default: "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg",
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

// Indexes (email đã có index từ unique: true)
accountSchema.index({ role: 1, isActive: 1 });

const Account = mongoose.model("Account", accountSchema);

export default Account;
