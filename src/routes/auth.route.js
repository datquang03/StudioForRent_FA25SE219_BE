import express from "express";
import * as customerAuthController from "../controllers/Auth/customer.auth.controller.js";
import * as adminAuthController from "../controllers/Auth/admin.auth.controller.js";
import {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateResendCode,
} from "../middlewares/validate.js";
import {
  authLimiter,
  strictLoginLimiter,
  verificationLimiter,
} from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * ============================================
 * AUTHENTICATION ROUTES
 * All public authentication endpoints
 * ============================================
 */

// ============================================
// CUSTOMER AUTHENTICATION
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký customer mới
 * @access  Public
 */
router.post("/register", authLimiter, validateRegister, customerAuthController.registerCustomer);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập customer
 * @access  Public
 */
router.post("/login", strictLoginLimiter, validateLogin, customerAuthController.loginCustomer);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Xác thực email bằng mã 6 số
 * @access  Public
 */
router.post("/verify-email", verificationLimiter, validateVerifyEmail, customerAuthController.verifyEmail);

/**
 * @route   POST /api/auth/resend-code
 * @desc    Gửi lại mã xác thực
 * @access  Public
 */
router.post("/resend-code", verificationLimiter, validateResendCode, customerAuthController.resendVerificationCode);

// ============================================
// ADMIN/STAFF AUTHENTICATION
// ============================================

/**
 * @route   POST /api/auth/setup-admin
 * @desc    Tạo tài khoản admin đầu tiên (one-time setup)
 * @access  Public (nhưng cần secret key)
 */
router.post("/setup-admin", authLimiter, adminAuthController.setupAdmin);

/**
 * @route   POST /api/auth/admin-login
 * @desc    Đăng nhập staff/admin
 * @access  Public
 */
router.post("/admin-login", strictLoginLimiter, adminAuthController.loginStaffAdmin);

export default router;
