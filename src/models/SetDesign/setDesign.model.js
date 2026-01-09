import mongoose from "mongoose";
import { SET_DESIGN_CATEGORIES } from '../../utils/constants.js';

/**
 * SET DESIGN MODEL
 * Simplified model for set design products that customers can browse, purchase, and review.
 *
 * Schema fields:
 *   - name: Display name of the set design
 *   - description: Detailed description of the design
 *   - price: Price for this set design
 *   - images: Array of image URLs (stored in Cloudinary)
 *   - reviews: Array of customer reviews and ratings
 *   - comments: Array of customer comments/questions
 *   - createdAt: Auto-generated creation timestamp
 *   - updatedAt: Auto-generated update timestamp
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
      min: [1, "Price must be greater than 0"],
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

    // Track if this SetDesign was converted from a CustomDesignRequest
    isConvertedFromCustomRequest: {
      type: Boolean,
      default: false,
    },

    // Reference to the original CustomDesignRequest (if converted)
    sourceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomDesignRequest',
      default: null,
    },

    // Staff who created this SetDesign
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for performance
setDesignSchema.index({ name: 1 });
setDesignSchema.index({ category: 1 });
setDesignSchema.index({ isActive: 1 });
setDesignSchema.index({ price: 1 });
setDesignSchema.index({ createdAt: -1 });

// Static method to get active designs
setDesignSchema.statics.getActiveDesigns = function() {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Static method to get designs by category
setDesignSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ createdAt: -1 });
};



const SetDesign = mongoose.model("SetDesign", setDesignSchema);

export default SetDesign;
