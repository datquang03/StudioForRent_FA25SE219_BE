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

    // === COMMENTS (Questions and discussions) ===
    comments: {
      type: [{
        customerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        customerName: {
          type: String,
          required: true,
        },
        message: {
          type: String,
          required: true,
          maxlength: [300, "Comment cannot exceed 300 characters"],
        },
        likes: {
          type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          }],
          default: [],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        replies: {
          type: [{
            userId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            userName: {
              type: String,
              required: true,
            },
            userRole: {
              type: String,
              enum: ['customer', 'staff', 'admin'],
              required: true,
            },
            message: {
              type: String,
              required: true,
              maxlength: [300, "Reply cannot exceed 300 characters"],
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          }],
          default: [],
        },
      }],
      default: [],
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
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for performance
setDesignSchema.index({ name: 1 });
setDesignSchema.index({ category: 1 });
setDesignSchema.index({ isActive: 1 });
setDesignSchema.index({ price: 1 });
setDesignSchema.index({ createdAt: -1 });

// Virtual for average rating - queries Review model
setDesignSchema.virtual('averageRating').get(async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({
    targetType: 'SetDesign',
    targetId: this._id,
    isHidden: false
  }).select('rating');
  
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal
});

// Virtual for total reviews count - queries Review model
setDesignSchema.virtual('totalReviews').get(async function() {
  const Review = mongoose.model('Review');
  return await Review.countDocuments({
    targetType: 'SetDesign',
    targetId: this._id,
    isHidden: false
  });
});

// Virtual for total comments count
setDesignSchema.virtual('totalComments').get(function() {
  return this.comments.length;
});

// Ensure virtual fields are serialized
setDesignSchema.set('toJSON', { virtuals: true });
setDesignSchema.set('toObject', { virtuals: true });

// Static method to get active designs
setDesignSchema.statics.getActiveDesigns = function() {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Static method to get designs by category
setDesignSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ createdAt: -1 });
};

// Instance method to add comment
setDesignSchema.methods.addComment = function(customerId, customerName, message) {
  this.comments.push({
    customerId,
    customerName,
    message,
    createdAt: new Date(),
    replies: [],
  });
  return this.save();
};

// Instance method to reply to comment (both staff and customer)
setDesignSchema.methods.replyToComment = function(commentIndex, userId, userName, userRole, message) {
  if (this.comments[commentIndex]) {
    this.comments[commentIndex].replies.push({
      userId,
      userName,
      userRole,
      message,
      createdAt: new Date(),
    });
    return this.save();
  }
  throw new Error('Comment not found');
};

// Instance method to update comment
setDesignSchema.methods.updateComment = function(commentIndex, newMessage) {
  if (this.comments[commentIndex]) {
    this.comments[commentIndex].message = newMessage;
    return this.save();
  }
  throw new Error('Comment not found');
};

// Instance method to delete comment
setDesignSchema.methods.deleteComment = function(commentIndex) {
  if (this.comments[commentIndex]) {
    this.comments.splice(commentIndex, 1);
    return this.save();
  }
  throw new Error('Comment not found');
};

// Instance method to update reply
setDesignSchema.methods.updateReply = function(commentIndex, replyIndex, newMessage) {
  if (this.comments[commentIndex] && this.comments[commentIndex].replies[replyIndex]) {
    this.comments[commentIndex].replies[replyIndex].message = newMessage;
    return this.save();
  }
  throw new Error('Reply not found');
};

// Instance method to delete reply
setDesignSchema.methods.deleteReply = function(commentIndex, replyIndex) {
  if (this.comments[commentIndex] && this.comments[commentIndex].replies[replyIndex]) {
    this.comments[commentIndex].replies.splice(replyIndex, 1);
    return this.save();
  }
  throw new Error('Reply not found');
};

const SetDesign = mongoose.model("SetDesign", setDesignSchema);

export default SetDesign;
