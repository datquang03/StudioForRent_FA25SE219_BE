import express from "express";
import * as customerController from "../controllers/Customer/customer.controller.js";
import { protect, authorize } from "../middlewares/auth.js";
import { generalLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * ============================================
 * CUSTOMER ROUTES
 * Customer tự quản lý profile của mình
 * Rate limit: 100 requests / 15 phút
 * ============================================
 */

// Áp dụng rate limiting cho tất cả customer routes
router.use(generalLimiter);

// ============================================
// CUSTOMER PROFILE MANAGEMENT
// ============================================

/**
 * @route   GET /api/customers/profile
 * @desc    Customer xem profile của chính mình
 * @access  Private (Customer only)
 */
router.get("/profile", protect, authorize("customer"), customerController.getProfile);

/**
 * @route   PATCH /api/customers/profile
 * @desc    Customer cập nhật profile
 * @access  Private (Customer only)
 */
router.patch("/profile", protect, authorize("customer"), customerController.updateProfile);

/**
 * @route   DELETE /api/customers/profile
 * @desc    Customer xóa tài khoản (soft delete)
 * @access  Private (Customer only)
 */
router.delete("/profile", protect, authorize("customer"), customerController.deleteAccount);

export default router;
