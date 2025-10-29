import mongoose from "mongoose";
import { DISCOUNT_TYPE } from "../../utils/constants.js";

/**
 * PROMOTION MODEL
 * Theo PostgreSQL schema với discount_type và usage tracking
 */
const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
    },
    discountType: {
      type: String,
      enum: Object.values(DISCOUNT_TYPE),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(value) {
          if (this.discountType === DISCOUNT_TYPE.PERCENT) {
            return value >= 0 && value <= 100;
          }
          return value >= 0;
        },
        message: 'Percent discount must be between 0-100, fixed discount must be >= 0',
      },
    },
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Example: { minAmount: 500000, services: ['studio_large'] }
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.validFrom;
        },
        message: "validTo must be greater than validFrom",
      },
    },
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Validation: usedCount không được vượt quá usageLimit
promotionSchema.pre('save', function(next) {
  if (this.usageLimit !== null && this.usedCount > this.usageLimit) {
    next(new Error('usedCount cannot exceed usageLimit'));
  }
  next();
});

// Indexes
promotionSchema.index({ code: 1 });
promotionSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;
