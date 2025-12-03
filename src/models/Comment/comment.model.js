import mongoose from "mongoose";
import { COMMENT_TARGET_TYPES } from "../../utils/constants.js";

/**
 * COMMENT / Q&A MODEL
 * Hệ thống hỏi đáp tập trung cho Studio và SetDesign.
 * Staff/Admin sẽ trả lời các câu hỏi của Customer tại đây.
 */
const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Polymorphic Association: Comment này thuộc về cái gì?
    targetType: {
      type: String,
      enum: Object.values(COMMENT_TARGET_TYPES), // Chỉ hỗ trợ hỏi đáp cho Studio và Bối cảnh
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType", // Dynamic reference dựa trên targetType
    },
    content: {
      type: String,
      required: [true, "Nội dung câu hỏi không được để trống"],
      trim: true,
      maxlength: [500, "Câu hỏi không được quá 500 ký tự"],
    },
    // Replies (Threaded discussion - Staff, Admin, and Customers can reply)
    replies: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userRole: { type: String, enum: ["customer", "staff", "admin"] }, // Added 'customer'
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isHidden: {
      type: Boolean,
      default: false, // Dùng để ẩn các comment spam/vi phạm
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh danh sách comment của 1 Studio/SetDesign
commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
