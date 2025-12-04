import express from "express";
import { protect, optionalProtect } from "../middlewares/auth.js";
import { 
  createComment, 
  getComments, 
  replyToComment, 
  updateComment, 
  deleteComment,
  likeComment,
  likeReply
} from "../controllers/comment.controller.js";

const router = express.Router();

// Public: Get comments (Q&A) (Optional Auth for Staff/Admin visibility)
router.get("/", optionalProtect, getComments);

// Protected: Create comment (Authenticated Users)
router.post("/", protect, createComment);

// Protected: Reply to comment (Authenticated Users)
router.post("/:id/reply", protect, replyToComment);

// Protected: Like comment (Authenticated Users)
router.post("/:id/like", protect, likeComment);

// Protected: Like reply (Authenticated Users)
router.post("/:id/replies/:replyId/like", protect, likeReply);

// Protected: Update comment (Authenticated Users - Own comment)
router.put("/:id", protect, updateComment);

// Protected: Delete comment (Admin, Staff, or Owner)
router.delete("/:id", protect, deleteComment);

export default router;
