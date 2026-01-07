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

  // Status workflow: PENDING_APPROVAL → PENDING → PROCESSING → COMPLETED
  //                        ↓                ↓           ↓
  //                    REJECTED          FAILED      FAILED
  status: {
    type: String,
    enum: ['PENDING_APPROVAL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'],
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
    bin: String,
    accountNumber: String,
    accountName: String
  },

  payoutId: String,
  payoutReferenceId: String,
  payoutState: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  payoutResponse: mongoose.Schema.Types.Mixed,

  processedAt: Date,
  processedBy: mongoose.Schema.Types.ObjectId,
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
// Ensure only one active refund (PENDING_APPROVAL/PENDING/PROCESSING) exists per booking.
refundSchema.index(
  { bookingId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING_APPROVAL', 'PENDING', 'PROCESSING'] } } }
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

// Instance method to check if refund can be retried
refundSchema.methods.canRetry = function() {
  return this.status === 'FAILED' &&
         (!this.processedAt || Date.now() - this.processedAt > 24 * 60 * 60 * 1000); // 24h cooldown
};

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