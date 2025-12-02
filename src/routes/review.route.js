import express from "express";
import { protect, authorize } from "../middlewares/auth.js";
import { createReview, getReviews, replyToReview } from "../controllers/review.controller.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// Public: Get reviews
router.get("/", getReviews);

// Protected: Create review (Customer)
router.post("/", protect, authorize(USER_ROLES.CUSTOMER), createReview);

// Protected: Reply to review (Staff/Admin)
router.post("/:id/reply", protect, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), replyToReview);

export default router;
