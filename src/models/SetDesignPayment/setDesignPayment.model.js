import mongoose from "mongoose";
import { PAYMENT_STATUS, PAY_TYPE } from "../../utils/constants.js";

/**
 * SET DESIGN PAYMENT MODEL
 * Payments for set design orders
 */
const setDesignPaymentSchema = new mongoose.Schema(
  {
    // Reference to the order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SetDesignOrder",
      required: true,
    },

    // Internal payment code
    paymentCode: {
      type: String,
      required: true,
      unique: true,
    },

    // Payment amount
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },

    // Payment type
    payType: {
      type: String,
      enum: Object.values(PAY_TYPE),
      required: true,
    },

    // Payment status
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      required: true,
    },

    // External transaction ID (from PayOS)
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // QR code or checkout URL
    qrCodeUrl: {
      type: String,
    },

    // Payment expiration
    expiresAt: {
      type: Date,
    },

    // When payment was completed
    paidAt: {
      type: Date,
    },

    // Refund information
    refundReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },

    // Gateway response data
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
setDesignPaymentSchema.index({ orderId: 1, status: 1 });
setDesignPaymentSchema.index({ status: 1 });
setDesignPaymentSchema.index({ createdAt: -1 });

// Static method to get payments by order
setDesignPaymentSchema.statics.getByOrder = function(orderId) {
  return this.find({ orderId }).sort({ createdAt: -1 });
};

// Static method to get pending payments
setDesignPaymentSchema.statics.getPendingPayments = function() {
  return this.find({ status: PAYMENT_STATUS.PENDING })
    .populate('orderId')
    .sort({ createdAt: 1 });
};

const SetDesignPayment = mongoose.model("SetDesignPayment", setDesignPaymentSchema);

export default SetDesignPayment;
