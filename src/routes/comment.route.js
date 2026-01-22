import express from "express";
import { protect, optionalProtect } from "../middlewares/auth.js";
import { validateObjectId } from "../middlewares/validate.js";
import { 
  createComment, 
  getComments, 
  replyToComment, 
  updateComment, 
  deleteComment,
  likeComment,
  likeReply,
  getCommentById
} from "../controllers/comment.controller.js";

const router = express.Router();

// Public: Get comments (Q&A) (Optional Auth for Staff/Admin visibility)
router.get("/", optionalProtect, getComments);

// Public: Get comment by ID
router.get("/:id", validateObjectId(), optionalProtect, getCommentById);

// Protected: Create comment (Authenticated Users)
router.post("/", protect, createComment);

// Protected: Reply to comment (Authenticated Users)
router.post("/:id/reply", validateObjectId(), protect, replyToComment);

// Protected: Like comment (Authenticated Users)
router.post("/:id/like", validateObjectId(), protect, likeComment);

// Protected: Like reply (Authenticated Users)
router.post("/:id/replies/:replyId/like", validateObjectId(), protect, likeReply);

// Protected: Update comment (Authenticated Users - Own comment)
router.put("/:id", validateObjectId(), protect, updateComment);

// Protected: Delete comment (Admin, Staff, or Owner)
router.delete("/:id", validateObjectId(), protect, deleteComment);

export default router;
