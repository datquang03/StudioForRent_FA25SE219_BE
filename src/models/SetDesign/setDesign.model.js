import mongoose from "mongoose";
import { AI_SET_DESIGN_STATUS } from "../../utils/constants.js";

/**
 * AI SET DESIGN MODEL
 * Theo PostgreSQL schema: booking_set_requests (updated workflow)
 * Lưu lịch sử AI iterations và staff implementation
 */
const setDesignSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    
    // === AI GENERATION PHASE ===
    // Lưu tất cả lần thử AI (prompt + image URL)
    aiIterations: {
      type: [{
        prompt: String,
        imageUrl: String,
        generatedAt: {
          type: Date,
          default: Date.now,
        },
      }],
      default: [],
    },
    
    // Ảnh cuối cùng khách hàng chọn
    finalAiPrompt: {
      type: String,
    },
    finalAiImageUrl: {
      type: String,
    },
    
    // Danh sách props/dụng cụ cần thiết cho set design
    requiredProps: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Example: { items: ['backdrop-white', 'chair-vintage', 'plant-large'], notes: '...' }
    },
    
    // === STAFF EXECUTION PHASE ===
    staffInChargeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Ảnh setup thực tế sau khi staff dựng xong
    staffFinalSetupImages: {
      type: [String],
      default: [],
    },
    
    staffNotes: {
      type: String,
    },
    
    // Giá riêng cho set design này
    finalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // === STATUS WORKFLOW ===
    status: {
      type: String,
      enum: Object.values(AI_SET_DESIGN_STATUS),
      default: AI_SET_DESIGN_STATUS.DRAFTING,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
setDesignSchema.index({ bookingId: 1, status: 1 });
setDesignSchema.index({ staffInChargeId: 1 });

const SetDesign = mongoose.model("SetDesign", setDesignSchema);

export default SetDesign;
