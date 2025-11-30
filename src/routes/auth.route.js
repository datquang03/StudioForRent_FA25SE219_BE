import express from 'express';
import {
  registerCustomerController,
  verifyEmailController,
  resendCodeController,
  loginController,
  googleLoginController,
  refreshTokenController,
  logoutController,
  createStaffController,
  getMeController,
  changePasswordController,
  forgotPasswordController,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { verificationLimiter, passwordResetLimiter, userLimiter } from '../middlewares/rateLimiter.js';
import createRedisRateLimiter from '../middlewares/redisRateLimiter.js';
import { 
  validateRegistration,
  validateStaffRegistration,
  validateLogin, 
  validateEmailVerification,
  validateRefreshToken,
  sanitizeInput 
} from '../middlewares/validate.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

// Redis-backed rate limiters for auth endpoints (safe for free tier)
const redisAuthLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  keyGenerator: (req) => req.ip // per-IP for auth
});

const redisStrictLoginLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per window
  keyGenerator: (req) => req.ip // per-IP for login
});

// Public routes với rate limiting và validation
router.post('/register/customer', redisAuthLimiter, validateRegistration, registerCustomerController);
router.post('/verify', verificationLimiter, validateEmailVerification, verifyEmailController);
router.post('/resend-code', verificationLimiter, resendCodeController);
router.post('/login', redisStrictLoginLimiter, validateLogin, loginController);
router.post('/login/google', redisStrictLoginLimiter, googleLoginController);
router.post('/refresh', redisAuthLimiter, validateRefreshToken, refreshTokenController);
router.post('/logout', validateRefreshToken, logoutController);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordController);

// Protected routes
router.get('/me', protect, userLimiter, getMeController);
router.post('/change-password', protect, userLimiter, passwordResetLimiter, changePasswordController);
router.post('/register/staff', protect, authorize(USER_ROLES.ADMIN), userLimiter, validateStaffRegistration, createStaffController);

export default router;
