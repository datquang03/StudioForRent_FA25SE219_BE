import mongoose from 'mongoose';
import { SERVICE_STATUS } from '../../utils/constants.js';

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên dịch vụ là bắt buộc!'],
      trim: true,
      maxlength: [200, 'Tên dịch vụ không được quá 200 ký tự!'],
      index: { unique: true },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Mô tả không được quá 1000 ký tự!'],
      default: '',
    },
    pricePerUse: {
      type: Number,
      required: [true, 'Giá dịch vụ là bắt buộc!'],
      min: [0, 'Giá dịch vụ phải >= 0!'],
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(SERVICE_STATUS),
      default: SERVICE_STATUS.ACTIVE,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Pre-save hook: Sync isAvailable with status
serviceSchema.pre('save', function(next) {
  this.isAvailable = this.status === SERVICE_STATUS.ACTIVE;
  next();
});

// Indexes
serviceSchema.index({ status: 1 });
serviceSchema.index({ isAvailable: 1 });

const Service = mongoose.model('Service', serviceSchema);

export default Service;
