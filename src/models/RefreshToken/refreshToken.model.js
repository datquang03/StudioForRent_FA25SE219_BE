import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Regular index, không duplicate
    },
    token: {
      type: String,
      required: true,
      unique: true, // Unique index
    },
    expiresAt: {
      type: Date,
      required: true,
      // Không cần index: true ở đây vì đã có TTL index bên dưới
    },
    createdByIp: {
      type: String,
    },
    revokedAt: {
      type: Date,
    },
    revokedByIp: {
      type: String,
    },
    replacedByToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tự động xóa expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual để check token còn active không
refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expiresAt;
});

refreshTokenSchema.virtual('isActive').get(function () {
  return !this.revokedAt && !this.isExpired;
});

// Method để revoke token
refreshTokenSchema.methods.revoke = function (ipAddress) {
  this.revokedAt = new Date();
  this.revokedByIp = ipAddress;
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
