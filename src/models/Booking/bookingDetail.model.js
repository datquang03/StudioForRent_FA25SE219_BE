import mongoose from "mongoose";
import { BOOKING_DETAIL_TYPE } from "../../utils/constants.js";

/**
 * BOOKING DETAIL MODEL
 * Chi tiết thiết bị và dịch vụ cho booking - MỖI ITEM LÀ 1 DOCUMENT
 * Theo PostgreSQL schema: booking_details table (NORMALIZED)
 * 
 * Mỗi equipment hoặc service trong booking sẽ là 1 document riêng
 * Snapshot giá tại thời điểm booking để tránh thay đổi sau này
 */
const bookingDetailSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    
    // Phân loại: 'equipment' hoặc 'extra_service'
    detailType: {
      type: String,
      enum: Object.values(BOOKING_DETAIL_TYPE),
      required: true,
      index: true,
    },
    
    // Foreign Keys (nullable - chỉ 1 trong 2 được set)
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },
    extraServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    
    // Snapshot thông tin tại thời điểm booking
    description: {
      type: String,
      // Tên thiết bị/service tại thời điểm đặt
      // VD: "Canon EOS R5", "Make-up Artist"
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    
    // Giá đơn vị tại thời điểm booking (snapshot)
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      // subtotal = quantity * pricePerUnit
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Validation: Đảm bảo chỉ 1 FK được set dựa trên detailType
bookingDetailSchema.pre('save', function(next) {
  if (this.detailType === BOOKING_DETAIL_TYPE.EQUIPMENT) {
    if (!this.equipmentId || this.extraServiceId) {
      return next(new Error('Equipment detail must have equipmentId and not extraServiceId'));
    }
  } else if (this.detailType === BOOKING_DETAIL_TYPE.EXTRA_SERVICE) {
    if (!this.extraServiceId || this.equipmentId) {
      return next(new Error('Service detail must have extraServiceId and not equipmentId'));
    }
  }
  
  // Validate subtotal calculation
  const calculatedSubtotal = this.quantity * this.pricePerUnit;
  if (Math.abs(this.subtotal - calculatedSubtotal) > 0.01) {
    return next(new Error('Subtotal must equal quantity * pricePerUnit'));
  }
  
  next();
});

// Indexes
bookingDetailSchema.index({ bookingId: 1, detailType: 1 });
bookingDetailSchema.index({ equipmentId: 1 });
bookingDetailSchema.index({ extraServiceId: 1 });

const BookingDetail = mongoose.model("BookingDetail", bookingDetailSchema);

export default BookingDetail;
