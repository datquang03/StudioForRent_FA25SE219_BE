import mongoose from "mongoose";
import { SET_DESIGN_CATEGORIES } from '../../utils/constants.js';

/**
 * SET DESIGN MODEL
 * Refactored: Removed embedded reviews and comments.
 */
const setDesignSchema = new mongoose.Schema(
  {
    // === BASIC INFORMATION ===
    name: {
      type: String,
      required: [true, "Set design name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      required: [true, "Set design description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    price: {
      type: Number,
      required: [true, "Set design price is required"],
      min: [0, "Price cannot be negative"],
      default: 0,
    },

    // === IMAGES ===
    images: {
      type: [String], // Array of Cloudinary URLs
      default: [],
      validate: {
        validator: function(images) {
          return images.length <= 10; // Max 10 images per design
        },
        message: "Cannot have more than 10 images per set design"
      }
    },

    // === METADATA (Cached for performance) ===
    // Thay vì embedded array, ta chỉ lưu số liệu tổng hợp để hiển thị nhanh
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    category: {
      type: String,
      enum: SET_DESIGN_CATEGORIES,
      default: 'other',
    },

    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, 
  }
);

// Indexes for performance
setDesignSchema.index({ name: 1 });
setDesignSchema.index({ category: 1 });
setDesignSchema.index({ isActive: 1 });
setDesignSchema.index({ price: 1 });
setDesignSchema.index({ createdAt: -1 });

const SetDesign = mongoose.model("SetDesign", setDesignSchema);

export default SetDesign;
