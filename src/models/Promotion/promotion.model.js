import mongoose from "mongoose";
import { DISCOUNT_TYPE, PROMOTION_APPLICABLE_FOR } from "../../utils/constants.js";

/**
 * PROMOTION MODEL
 * Quản lý mã giảm giá với các ràng buộc và tracking
 */
const promotionSchema = new mongoose.Schema(
  {
    // Tên hiển thị
    name: {
      type: String,
      required: [true, 'Tên khuyến mãi là bắt buộc!'],
      trim: true,
      maxlength: [200, 'Tên khuyến mãi không được vượt quá 200 ký tự!']
    },
    
    // Mã giảm giá (bắt buộc, unique, uppercase)
    code: {
      type: String,
      required: [true, 'Mã khuyến mãi là bắt buộc!'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{6,20}$/, 'Mã khuyến mãi chỉ chấp nhận chữ HOA và số, từ 6-20 ký tự!']
    },
    
    // Mô tả
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Mô tả không được vượt quá 1000 ký tự!']
    },
    
    // Loại giảm giá: percentage hoặc fixed
    discountType: {
      type: String,
      enum: {
        values: Object.values(DISCOUNT_TYPE),
        message: 'Loại giảm giá không hợp lệ! Chỉ chấp nhận: {VALUES}'
      },
      required: [true, 'Loại giảm giá là bắt buộc!']
    },
    
    // Giá trị giảm (% hoặc VND)
    discountValue: {
      type: Number,
      required: [true, 'Giá trị giảm là bắt buộc!'],
      min: [0, 'Giá trị giảm phải >= 0!'],
      validate: {
        validator: function(value) {
          if (this.discountType === DISCOUNT_TYPE.PERCENTAGE) {
            return value >= 0 && value <= 100;
          }
          return value >= 0;
        },
        message: 'Giảm theo % phải từ 0-100, giảm cố định phải >= 0!'
      }
    },
    
    // Giảm tối đa (chỉ áp dụng cho percentage)
    maxDiscount: {
      type: Number,
      min: [0, 'Giảm tối đa phải >= 0!'],
      validate: {
        validator: function(value) {
          // Chỉ validate nếu discountType là percentage
          if (this.discountType === DISCOUNT_TYPE.PERCENTAGE) {
            return value !== undefined && value !== null && value > 0;
          }
          return true; // Fixed type không cần maxDiscount
        },
        message: 'Giảm theo % phải có giá trị giảm tối đa!'
      }
    },
    
    // Giá trị đơn hàng tối thiểu để áp dụng
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Giá trị đơn hàng tối thiểu phải >= 0!']
    },
    
    // Áp dụng cho đối tượng nào
    applicableFor: {
      type: String,
      enum: {
        values: Object.values(PROMOTION_APPLICABLE_FOR),
        message: 'Đối tượng áp dụng không hợp lệ! Chỉ chấp nhận: {VALUES}'
      },
      default: PROMOTION_APPLICABLE_FOR.ALL
    },
    
    // Ngày bắt đầu
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu là bắt buộc!']
    },
    
    // Ngày kết thúc
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc là bắt buộc!'],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: 'Ngày kết thúc phải sau ngày bắt đầu!'
      }
    },
    
    // Giới hạn số lần sử dụng
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
      min: [1, 'Giới hạn sử dụng phải >= 1 hoặc null (không giới hạn)!']
    },
    
    // Số lần đã sử dụng
    usageCount: {
      type: Number,
      default: 0,
      min: [0, 'Số lần sử dụng không được âm!']
    },
    
    // ========== NEW FIELDS FOR BUSINESS CONSTRAINTS ==========
    
    // Giới hạn số lần dùng per user (null = unlimited)
    usageLimitPerUser: {
      type: Number,
      default: null,
      min: [1, 'Giới hạn sử dụng mỗi người phải >= 1!']
    },
    
    // Ngày áp dụng trong tuần (0=Sunday, 1-6=Monday-Saturday)
    // null hoặc [] = tất cả các ngày
    applicableDays: {
      type: [Number],
      default: null,
      validate: {
        validator: function(arr) {
          if (!arr || arr.length === 0) return true;
          return arr.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
        },
        message: 'Ngày áp dụng phải từ 0 (Chủ Nhật) đến 6 (Thứ 7)!'
      }
    },
    
    // Giờ áp dụng trong ngày (null = cả ngày)
    applicableHours: {
      startHour: {
        type: Number,
        min: [0, 'Giờ bắt đầu phải >= 0!'],
        max: [23, 'Giờ bắt đầu phải <= 23!']
      },
      endHour: {
        type: Number,
        min: [0, 'Giờ kết thúc phải >= 0!'],
        max: [23, 'Giờ kết thúc phải <= 23!']
      }
    },
    
    // Budget cap: Tổng ngân sách tối đa cho campaign (null = unlimited)
    maxTotalDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Ngân sách tối đa phải >= 0!']
    },
    
    // Tracking: Tổng số tiền đã giảm cho khách
    totalDiscountedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tổng tiền đã giảm không được âm!']
    },
    
    // ========== END NEW FIELDS ==========
    
    // Trạng thái kích hoạt
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save validations
promotionSchema.pre('save', function(next) {
  // Kiểm tra usageCount không vượt quá usageLimit
  if (this.usageLimit !== null && this.usageCount > this.usageLimit) {
    return next(new Error('Số lần sử dụng không được vượt quá giới hạn!'));
  }
  
  // Nếu là percentage, bắt buộc phải có maxDiscount
  if (this.discountType === DISCOUNT_TYPE.PERCENTAGE && !this.maxDiscount) {
    return next(new Error('Giảm theo % phải có giá trị giảm tối đa (maxDiscount)!'));
  }
  
  next();
});

// Indexes cho performance (code đã có unique trong schema definition)
promotionSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ applicableFor: 1, isActive: 1 });

// Methods
promotionSchema.methods = {
  /**
   * Kiểm tra promotion còn hợp lệ không
   */
  isValid() {
    const now = new Date();
    
    // Kiểm tra active
    if (!this.isActive) return false;
    
    // Kiểm tra thời gian (startDate, endDate)
    if (now < this.startDate || now > this.endDate) return false;
    
    // Kiểm tra usage limit (tổng toàn hệ thống)
    if (this.usageLimit !== null && this.usageCount >= this.usageLimit) return false;
    
    // Kiểm tra budget cap
    if (this.maxTotalDiscountAmount !== null && 
        this.totalDiscountedAmount >= this.maxTotalDiscountAmount) {
      return false;
    }
    
    return true;
  },
  
  /**
   * Tính toán số tiền giảm
   * @param {Number} orderAmount - Tổng giá trị đơn hàng
   * @returns {Number} - Số tiền được giảm
   */
  calculateDiscount(orderAmount) {
    // Kiểm tra đơn hàng tối thiểu
    if (orderAmount < this.minOrderValue) return 0;
    
    let discount = 0;
    
    if (this.discountType === DISCOUNT_TYPE.PERCENTAGE) {
      // Giảm theo %
      discount = (orderAmount * this.discountValue) / 100;
      // Giới hạn tối đa
      if (this.maxDiscount && discount > this.maxDiscount) {
        discount = this.maxDiscount;
      }
    } else {
      // Giảm cố định
      discount = this.discountValue;
      // Không được giảm quá tổng đơn hàng
      if (discount > orderAmount) {
        discount = orderAmount;
      }
    }
    
    return Math.round(discount); // Làm tròn
  }
};

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;
