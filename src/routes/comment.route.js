import express from "express";
import { protect, authorize, optionalProtect } from "../middlewares/auth.js";
import { 
  createComment, 
  getComments, 
  replyToComment, 
  updateComment, 
  deleteComment 
} from "../controllers/comment.controller.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// Public: Get comments (Q&A) (Optional Auth for Staff/Admin visibility)
router.get("/", optionalProtect, getComments);

// Protected: Create comment (Authenticated Users)
router.post("/", protect, createComment);

// Protected: Reply to comment (Authenticated Users)
router.post("/:id/reply", protect, replyToComment);

// Protected: Update comment (Authenticated Users - Own comment)
router.put("/:id", protect, updateComment);

// Protected: Delete comment (Admin, Staff, or Owner)
router.delete("/:id", protect, deleteComment);

export default router;
