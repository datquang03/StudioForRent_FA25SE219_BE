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
refundSchema.index({ paymentId: 1, status: 1 });
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
  const match = {};
  if (startDate || endDate) {
    match.requestedAt = {};
    if (startDate) match.requestedAt.$gte = startDate;
    if (endDate) match.requestedAt.$lte = endDate;
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;