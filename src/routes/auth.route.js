import express from 'express';
import {
  registerCustomerController,
  verifyEmailController,
  resendCodeController,
  loginController,
  refreshTokenController,
  logoutController,
  createStaffController,
  getMeController,
  changePasswordController,
  forgotPasswordController,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { authLimiter, strictLoginLimiter, verificationLimiter, passwordResetLimiter } from '../middlewares/rateLimiter.js';
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

// Public routes với rate limiting và validation
router.post('/register/customer', authLimiter, validateRegistration, registerCustomerController);
router.post('/verify', verificationLimiter, validateEmailVerification, verifyEmailController);
router.post('/resend-code', verificationLimiter, resendCodeController);
router.post('/login', strictLoginLimiter, validateLogin, loginController);
router.post('/refresh', authLimiter, validateRefreshToken, refreshTokenController);
router.post('/logout', validateRefreshToken, logoutController);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordController);

// Protected routes
router.get('/me', protect, getMeController);
router.post('/change-password', protect, passwordResetLimiter, changePasswordController);
router.post('/register/staff', protect, authorize(USER_ROLES.ADMIN), validateStaffRegistration, createStaffController);

export default router;
