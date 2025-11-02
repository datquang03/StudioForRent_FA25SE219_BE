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
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { authLimiter, strictLoginLimiter, verificationLimiter } from '../middlewares/rateLimiter.js';
import { 
  validateRegistration,
  validateStaffRegistration,
  validateLogin, 
  validateEmailVerification,
  validateRefreshToken,
  sanitizeInput 
} from '../middlewares/validation.js';
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

// Protected routes
router.get('/me', protect, getMeController);
router.post('/change-password', protect, changePasswordController);
router.post('/register/staff', protect, authorize(USER_ROLES.ADMIN), validateStaffRegistration, createStaffController);

export default router;
