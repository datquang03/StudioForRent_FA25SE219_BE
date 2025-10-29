import mongoose from "mongoose";
import { PAYMENT_STATUS, PAY_TYPE } from "../../utils/constants.js";

/**
 * PAYMENT MODEL
 * Theo PostgreSQL schema - merge Payment & Bill
 */
const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payType: {
      type: String,
      enum: Object.values(PAY_TYPE),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    qrCodeUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    refundReason: {
      type: String,
    },
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
paymentSchema.index({ bookingId: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
