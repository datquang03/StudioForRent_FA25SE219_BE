import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../../utils/constants.js";

/**
 * SET DESIGN ORDER STATUS
 */
export const SET_DESIGN_ORDER_STATUS = {
  PENDING: "pending",           // Order created, awaiting payment
  CONFIRMED: "confirmed",       // Payment received, order confirmed
  PROCESSING: "processing",     // Staff is preparing the design
  READY: "ready",              // Design is ready for pickup/use
  COMPLETED: "completed",       // Order completed
  CANCELLED: "cancelled",       // Order cancelled
};

/**
 * SET DESIGN ORDER MODEL
 * For customers to order/purchase set designs
 */
const setDesignOrderSchema = new mongoose.Schema(
  {
    // Order code for tracking
    orderCode: {
      type: String,
      required: true,
      unique: true,
    },

    // Customer who placed the order
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Set design being ordered
    setDesignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SetDesign",
      required: true,
    },

    // Booking this order is associated with (optional)
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    // Quantity ordered
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },

    // Price at time of order (snapshot)
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
    },

    // Total amount (quantity * unitPrice)
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },

    // Amount paid so far
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "Paid amount cannot be negative"],
    },

    // Order status
    status: {
      type: String,
      enum: Object.values(SET_DESIGN_ORDER_STATUS),
      default: SET_DESIGN_ORDER_STATUS.PENDING,
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },

    // Customer notes
    customerNotes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    // Staff notes (internal)
    staffNotes: {
      type: String,
      maxlength: [500, "Staff notes cannot exceed 500 characters"],
    },

    // Usage date - when customer wants to use the design
    usageDate: {
      type: Date,
    },

    // Processed by staff
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Timestamps
    confirmedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      maxlength: [500, "Cancel reason cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
setDesignOrderSchema.index({ customerId: 1 });
setDesignOrderSchema.index({ setDesignId: 1 });
setDesignOrderSchema.index({ bookingId: 1 });
setDesignOrderSchema.index({ status: 1 });
setDesignOrderSchema.index({ paymentStatus: 1 });
setDesignOrderSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate total amount
setDesignOrderSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalAmount = this.quantity * this.unitPrice;
  }
  next();
});

// Static method to generate order code
setDesignOrderSchema.statics.generateOrderCode = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SDO-${timestamp}-${random}`;
};

// Static method to get orders by customer
setDesignOrderSchema.statics.getByCustomer = function(customerId) {
  return this.find({ customerId })
    .populate('setDesignId', 'name images price category')
    .sort({ createdAt: -1 });
};

// Static method to get pending orders
setDesignOrderSchema.statics.getPendingOrders = function() {
  return this.find({ status: SET_DESIGN_ORDER_STATUS.PENDING })
    .populate('customerId', 'username email')
    .populate('setDesignId', 'name images price')
    .sort({ createdAt: 1 });
};

const SetDesignOrder = mongoose.model("SetDesignOrder", setDesignOrderSchema);

export default SetDesignOrder;
