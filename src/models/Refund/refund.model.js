import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  // Reference to Payment
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },

  // Refund details
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

  // Status workflow
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true
  },

  // Audit trail
  requestedAt: {
    type: Date,
    default: Date.now
    // Removed index: true to avoid duplicate with schema.index()
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // PayOS integration
  payosRefundId: String,
  payosResponse: mongoose.Schema.Types.Mixed,

  // Processing results
  processedAt: Date,
  processedBy: mongoose.Schema.Types.ObjectId,
  failureReason: String
}, {
  timestamps: true
});

// Indexes for performance
// Ensure only one active refund (PENDING/PROCESSING) exists per payment.
// Use a partial unique index to allow multiple historical COMPLETED/FAILED refunds.
refundSchema.index(
  { paymentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'PROCESSING'] } } }
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