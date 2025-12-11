import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../../utils/constants.js';

/**
 * EQUIPMENT PAYMENT MODEL
 * Tracks payments for equipment orders (Full payment only)
 */
const equipmentPaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EquipmentOrder',
      required: true,
      index: true,
    },
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    qrCodeUrl: {
      type: String,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Indexes for efficient queries
equipmentPaymentSchema.index({ orderId: 1, status: 1 });
equipmentPaymentSchema.index({ status: 1 });
equipmentPaymentSchema.index({ createdAt: -1 });

const EquipmentPayment = mongoose.model('EquipmentPayment', equipmentPaymentSchema);

export default EquipmentPayment;
