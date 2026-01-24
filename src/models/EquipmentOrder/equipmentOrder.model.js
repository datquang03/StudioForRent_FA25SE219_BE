import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../../utils/constants.js';

/**
 * Equipment Order Status
 */
export const EQUIPMENT_ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_USE: 'in_use',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * EQUIPMENT ORDER MODEL
 * Tracks equipment rental orders with full payment only
 */
const equipmentOrderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    hours: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    rentalStartTime: {
      type: Date,
      required: true,
    },
    rentalEndTime: {
      type: Date,
      required: true,
    },
    customerNotes: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: Object.values(EQUIPMENT_ORDER_STATUS),
      default: EQUIPMENT_ORDER_STATUS.PENDING,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      required: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    staffNotes: {
      type: String,
      maxlength: 1000,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Generate unique order code
equipmentOrderSchema.statics.generateOrderCode = function () {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `EQP-${timestamp}-${random}`;
};

// Indexes for efficient queries
equipmentOrderSchema.index({ customerId: 1, createdAt: -1 });
equipmentOrderSchema.index({ status: 1, createdAt: -1 });
equipmentOrderSchema.index({ paymentStatus: 1 });
equipmentOrderSchema.index({ rentalStartTime: 1, rentalEndTime: 1 });

const EquipmentOrder = mongoose.model('EquipmentOrder', equipmentOrderSchema);

export default EquipmentOrder;
