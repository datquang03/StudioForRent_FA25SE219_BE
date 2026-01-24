import mongoose from "mongoose";
import { PAYMENT_STATUS, PAY_TYPE, TARGET_MODEL, PAYMENT_CATEGORY } from "../../utils/constants.js";

/**
 * PAYMENT MODEL
 * Theo PostgreSQL schema - merge Payment & Bill
 */
const paymentSchema = new mongoose.Schema(
  {
    // Cũ - Giữ lại để backward compatibility
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      // required: true, // Tạm thời bỏ required để support các loại order khác
    },

    // Mới - Polymorphic Reference
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel'
    },
    targetModel: {
      type: String,
      required: true,
      enum: Object.values(TARGET_MODEL)
    },
    
    // Category để filter dễ hơn
    category: {
      type: String,
      enum: Object.values(PAYMENT_CATEGORY),
      default: PAYMENT_CATEGORY.BOOKING
    },
    
    // Mã giao dịch nội bộ (VD: "SCREW-1001", "PAY-20251031-001")
    paymentCode: {
      type: String,
      required: true,
      unique: true, // unique tự động tạo index
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
    
    // Mã giao dịch từ bên thứ 3 (VD: PayOS)
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    qrCodeUrl: {
      type: String,
    },
    expiresAt: {
      type: Date,
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
paymentSchema.index({ targetId: 1, targetModel: 1 });
paymentSchema.index({ bookingId: 1, status: 1 }); // Giữ index cũ
paymentSchema.index({ status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
