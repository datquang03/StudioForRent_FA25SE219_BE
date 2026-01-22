import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
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
// Ensure only one active refund (PENDING_APPROVAL/APPROVED) exists per booking.
refundSchema.index(
  { bookingId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING_APPROVAL', 'APPROVED'] } } }
);
refundSchema.index({ status: 1, requestedAt: -1 });
refundSchema.index({ requestedAt: 1 });

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