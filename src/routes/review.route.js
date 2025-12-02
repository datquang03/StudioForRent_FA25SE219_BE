import express from "express";
import { protect, authorize, optionalProtect } from "../middlewares/auth.js";
import { 
  createReview, 
  getReviews, 
  replyToReview, 
  updateReview, 
  toggleReviewVisibility,
  updateReviewReply
} from "../controllers/review.controller.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// Public: Get reviews (Optional Auth for Staff/Admin visibility)
router.get("/", optionalProtect, getReviews);

// Protected: Create review (Customer)
router.post("/", protect, authorize(USER_ROLES.CUSTOMER), createReview);

// Protected: Update review (Customer - Own review)
router.put("/:id", protect, authorize(USER_ROLES.CUSTOMER), updateReview);

// Protected: Reply to review (Staff/Admin)
router.post("/:id/reply", protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), replyToReview);

// Protected: Update review reply (Staff/Admin)
router.put("/:id/reply", protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateReviewReply);

// Protected: Toggle visibility (Admin only)
router.patch("/:id/visibility", protect, authorize(USER_ROLES.ADMIN), toggleReviewVisibility);

export default router;
