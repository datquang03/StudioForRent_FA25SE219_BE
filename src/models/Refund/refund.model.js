import mongoose from 'mongoose';
import { TARGET_MODEL } from '../../utils/constants.js';

const refundSchema = new mongoose.Schema({
  // Polymorphic reference - supports Booking, SetDesignOrder, EquipmentOrder
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetModel',
    index: true
  },
  targetModel: {
    type: String,
    enum: Object.values(TARGET_MODEL),
    default: TARGET_MODEL.BOOKING
  },

  // Legacy field for backward compatibility with existing Booking refunds
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },

  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },

  // Proof images uploaded by customer (optional, max 3)
  proofImages: [{
    type: String  // Cloudinary URLs
  }],

  // Refund status workflow
  // Source of truth for allowed transitions: validators.js (REFUND_TRANSITIONS)
  // PENDING_APPROVAL → APPROVED → COMPLETED
  //                └────────────→ REJECTED
  status: {
    type: String,
    enum: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED'],
    default: 'PENDING_APPROVAL',
    index: true
  },

  requestedAt: {
    type: Date,
    default: Date.now
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  destinationBank: {
    bankName: String,       // Tên ngân hàng (VD: "Vietcombank", "MB Bank")
    accountNumber: String,  // Số tài khoản
    accountName: String     // Tên chủ tài khoản
  },

  // Manual transfer details (filled when staff confirms transfer)
  transferDetails: {
    transactionRef: String,  // Mã giao dịch ngân hàng
    note: String,            // Ghi chú của staff
    proofImageUrl: String,   // Cloudinary URL of transfer screenshot (ảnh chứng từ)
    confirmedAt: Date        // Thời điểm xác nhận
  },

  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  failureReason: String,

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Indexes for performance
// Polymorphic index for targetId + targetModel (for SetDesignOrder, EquipmentOrder)
refundSchema.index(
  { targetId: 1, targetModel: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING_APPROVAL', 'APPROVED'] } } }
);

// Legacy index for bookingId (backward compatibility)
refundSchema.index(
  { bookingId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING_APPROVAL', 'APPROVED'] }, bookingId: { $exists: true, $ne: null } } }
);
refundSchema.index({ status: 1, requestedAt: -1 });
refundSchema.index({ requestedAt: 1 });

// Pre-save middleware to sync bookingId with targetId for Booking type
refundSchema.pre('save', function(next) {
  if (this.targetModel === 'Booking' && this.targetId && !this.bookingId) {
    this.bookingId = this.targetId;
  }
  // If bookingId is set but targetId is not, sync them (backward compatibility)
  if (this.bookingId && !this.targetId) {
    this.targetId = this.bookingId;
    this.targetModel = 'Booking';
  }
  next();
});

// Virtual for refund duration
refundSchema.virtual('processingDuration').get(function() {
  if (this.processedAt && this.requestedAt) {
    return this.processedAt - this.requestedAt;
  }
  return null;
});

// Static method to get refund statistics
refundSchema.statics.getStats = async function(startDate, endDate) {
  const query = {};
  if (startDate || endDate) {
    query.requestedAt = {};
    if (startDate) query.requestedAt.$gte = startDate;
    if (endDate) query.requestedAt.$lte = endDate;
  }

  const refunds = await this.find(query).select('status amount').lean();

  // Group by status and calculate stats
  const statsMap = new Map();

  for (const refund of refunds) {
    const status = refund.status;
    if (!statsMap.has(status)) {
      statsMap.set(status, {
        _id: status,
        count: 0,
        totalAmount: 0,
        amounts: []
      });
    }

    const stat = statsMap.get(status);
    stat.count++;
    stat.totalAmount += refund.amount;
    stat.amounts.push(refund.amount);
  }

  // Calculate averages
  const result = [];
  for (const [status, stat] of statsMap) {
    stat.avgAmount = stat.amounts.length > 0 ?
      stat.amounts.reduce((sum, amount) => sum + amount, 0) / stat.amounts.length : 0;
    delete stat.amounts;
    result.push(stat);
  }

  return result;
};

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;