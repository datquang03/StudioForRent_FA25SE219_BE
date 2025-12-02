import express from "express";
import { protect, authorize } from "../middlewares/auth.js";
import { createComment, getComments, replyToComment, deleteComment } from "../controllers/comment.controller.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// Public: Get comments (Q&A)
router.get("/", getComments);

// Protected: Create comment (Customer/User)
router.post("/", protect, createComment);

// Protected: Reply to comment (Authenticated Users)
router.post("/:id/reply", protect, replyToComment);

// Protected: Delete comment
router.delete("/:id", protect, deleteComment);

export default router;
