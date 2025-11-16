import mongoose from "mongoose";

/**
 * ROOM POLICY MODEL
 * Generic policy model supporting both cancellation and no-show policies
 */
const roomPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },

    // Policy type discriminator
    type: {
      type: String,
      enum: ['CANCELLATION', 'NO_SHOW'],
      required: true
    },

    // For CANCELLATION policies
    refundTiers: [{
      hoursBeforeBooking: {
        type: Number,
        required: function() { return this.parent().type === 'CANCELLATION'; }
      },
      refundPercentage: {
        type: Number,
        required: function() { return this.parent().type === 'CANCELLATION'; },
        min: 0,
        max: 100
      },
      description: String
    }],

    // For NO_SHOW policies
    noShowRules: {
      chargeType: {
        type: String,
        enum: ['FULL_CHARGE', 'PARTIAL_CHARGE', 'GRACE_PERIOD', 'FORGIVENESS'],
        required: function() { return this.parent().type === 'NO_SHOW'; }
      },
      chargePercentage: {
        type: Number,
        min: 0,
        max: 100,
        required: function() {
          return this.parent().type === 'NO_SHOW' &&
                 this.parent().noShowRules?.chargeType === 'PARTIAL_CHARGE';
        }
      },
      graceMinutes: {
        type: Number,
        default: 15,
        required: function() {
          return this.parent().type === 'NO_SHOW' &&
                 this.parent().noShowRules?.chargeType === 'GRACE_PERIOD';
        }
      },
      maxForgivenessCount: {
        type: Number,
        default: 1,
        required: function() {
          return this.parent().type === 'NO_SHOW' &&
                 this.parent().noShowRules?.chargeType === 'FORGIVENESS';
        }
      }
    },

    // Common fields
    category: {
      type: String,
      enum: ['FLEXIBLE', 'STANDARD', 'MODERATE', 'PREMIUM', 'STRICT'],
      default: 'STANDARD'
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// Auto-sort refund tiers
roomPolicySchema.pre('save', function (next) {
  if (this.type === 'CANCELLATION' && this.refundTiers?.length > 0) {
    this.refundTiers.sort((a, b) => b.hoursBeforeBooking - a.hoursBeforeBooking);
  }
  next();
});

// Indexes
roomPolicySchema.index({ type: 1, isActive: 1 });
roomPolicySchema.index({ category: 1 });
roomPolicySchema.index({ "refundTiers.hoursBeforeBooking": 1 });

const RoomPolicy = mongoose.model("RoomPolicy", roomPolicySchema);

export default RoomPolicy;
