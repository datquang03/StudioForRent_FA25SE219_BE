import mongoose from "mongoose";

/**
 * CUSTOM DESIGN REQUEST MODEL
 * Stores customer requests for custom set designs with AI-generated images.
 * 
 * Workflow:
 * 1. Customer submits request with description, contact info
 * 2. System generates AI image based on description
 * 3. Staff reviews and can approve/reject
 * 4. Approved requests can be converted to actual SetDesign products
 */
const customDesignRequestSchema = new mongoose.Schema(
  {
    // === CUSTOMER INFORMATION ===
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9]{10,11}$/, "Please provide a valid phone number (10-11 digits)"],
    },

    // === DESIGN REQUEST ===
    description: {
      type: String,
      required: [true, "Design description is required"],
      trim: true,
      minlength: [20, "Description must be at least 20 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // AI-generated image based on description
    generatedImage: {
      type: String, // Cloudinary URL
      default: null,
    },

    // Additional reference images uploaded by customer (optional)
    referenceImages: {
      type: [String], // Array of Cloudinary URLs
      default: [],
      validate: {
        validator: function(images) {
          return images.length <= 5; // Max 5 reference images
        },
        message: "Cannot upload more than 5 reference images"
      }
    },

    // === REQUEST STATUS ===
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending',
    },

    // === STAFF PROCESSING ===
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    staffNotes: {
      type: String,
      maxlength: [500, "Staff notes cannot exceed 500 characters"],
      default: null,
    },

    // If approved and converted to actual SetDesign product
    convertedToDesignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SetDesign",
      default: null,
    },

    // Estimated price quoted by staff (optional)
    estimatedPrice: {
      type: Number,
      min: [0, "Price cannot be negative"],
      default: null,
    },

    // === AI GENERATION METADATA ===
    aiGenerationAttempts: {
      type: Number,
      default: 0,
    },

    aiModel: {
      type: String,
      default: 'gemini-2.5-flash',
    },

    // === CUSTOMER PREFERENCES (OPTIONAL) ===
    preferredCategory: {
      type: String,
      enum: ['wedding', 'portrait', 'corporate', 'event', 'family', 'graduation', 'other'],
      default: 'other',
    },

    budgetRange: {
      min: {
        type: Number,
        min: 0,
        default: null,
      },
      max: {
        type: Number,
        min: 0,
        default: null,
      }
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for performance
customDesignRequestSchema.index({ email: 1 });
customDesignRequestSchema.index({ status: 1 });
customDesignRequestSchema.index({ createdAt: -1 });
customDesignRequestSchema.index({ processedBy: 1 });

// Virtual for request age in days
customDesignRequestSchema.virtual('requestAge').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Ensure virtual fields are serialized
customDesignRequestSchema.set('toJSON', { virtuals: true });
customDesignRequestSchema.set('toObject', { virtuals: true });

// Static method to get pending requests
customDesignRequestSchema.statics.getPendingRequests = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};

// Static method to get requests by status
customDesignRequestSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Instance method to mark as processing
customDesignRequestSchema.methods.markAsProcessing = function(staffId) {
  this.status = 'processing';
  this.processedBy = staffId;
  return this.save();
};

// Instance method to approve and set price
customDesignRequestSchema.methods.approve = function(notes) {
  this.status = 'completed';
  if (notes) this.staffNotes = notes;
  return this.save();
};

// Instance method to reject
customDesignRequestSchema.methods.reject = function(notes) {
  this.status = 'rejected';
  this.staffNotes = notes;
  return this.save();
};

const CustomDesignRequest = mongoose.model("CustomDesignRequest", customDesignRequestSchema);

export default CustomDesignRequest;
