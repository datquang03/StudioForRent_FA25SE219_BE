import express from "express";
import { protect } from "../middlewares/auth.js";
import { reviewLimiter } from "../middlewares/rateLimiter.js";
import { createReview, listReviewsByStudio, getReviewForBooking } from "../controllers/review.controller.js";

const router = express.Router();

// Create a review for a completed booking (customer to studio)
router.post("/", protect, reviewLimiter, createReview);

// List reviews for a studio
router.get("/studio/:studioId", listReviewsByStudio);

// Get review by bookingId
router.get("/booking/:bookingId", getReviewForBooking);

export default router;
