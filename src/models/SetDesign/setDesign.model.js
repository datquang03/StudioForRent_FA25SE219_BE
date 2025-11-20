import mongoose from "mongoose";
import { AI_SET_DESIGN_STATUS } from "../../utils/constants.js";

/**
 * AI SET DESIGN MODEL
 * Chat-based AI design workflow:
 * 1. Customer chats with AI about their photoshoot vision
 * 2. AI generates design suggestions based on conversation
 * 3. Customer selects and confirms a design
  * 4. Staff receives confirmed design and implements it
 *
 * BREAKING CHANGE (v2): Legacy fields `finalAiPrompt` and `finalAiImageUrl` have been removed.
 *   - Previously, the final AI-generated prompt and image URL were stored separately.
 *   - Now, the confirmed design is stored in the `finalDesign` object, which includes:
 *       - title, description, colorScheme, lighting, mood, cameraAngles, specialEffects, imageUrl, confirmedAt
 *   - This change allows for richer, structured data and better tracking of customer confirmation.
 *
 *   Service layer code referencing the old fields must be updated to use `finalDesign`.
 *
 * Schema fields:
 *   - bookingId: Reference to Booking
 *   - chatHistory: Array of customer/AI messages
 *   - aiIterations: Array of AI-generated design suggestions
 *   - finalDesign: The design confirmed by the customer (see above)
 *   - requiredProps: List of props/items needed for the set design
 *   - staffInChargeId: Staff member responsible for execution
 *   - staffFinalSetupImages: Images of the final setup
 *   - staffNotes: Staff notes/comments
 *   - finalPrice: Price for the set design
 *   - status: Workflow status
 */
const setDesignSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    
    // === CUSTOMER-AI CHAT HISTORY ===
    chatHistory: {
      type: [{
        role: {
          type: String,
          enum: ['customer', 'ai'],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      }],
      default: [],
    },
    
    // === AI GENERATION PHASE ===
    // Lưu tất cả design iterations AI tạo trong cuộc trò chuyện
    aiIterations: {
      type: [{
        title: String,
        description: String,
        colorScheme: [String],
        lighting: String,
        mood: String,
        cameraAngles: [String],
        specialEffects: [String],
        imageUrl: String, // Optional: Generated image from Imagen
        generatedAt: {
          type: Date,
          default: Date.now,
        },
      }],
      default: [],
    },
    
    // === CUSTOMER CONFIRMATION ===
    // Design cuối cùng khách hàng chọn và xác nhận
    finalDesign: {
      type: {
        title: String,
        description: String,
        colorScheme: [String],
        lighting: String,
        mood: String,
        cameraAngles: [String],
        specialEffects: [String],
        imageUrl: String,
        confirmedAt: Date,
      },
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
