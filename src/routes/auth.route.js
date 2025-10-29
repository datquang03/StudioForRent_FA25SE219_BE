import express from 'express';
import {
  registerCustomerController,
  verifyEmailController,
  resendCodeController,
  loginController,
  createStaffController,
  getMeController,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.post('/register/customer', registerCustomerController);
router.post('/verify', verifyEmailController);
router.post('/resend-code', resendCodeController);
router.post('/login', loginController);
router.get('/me', protect, getMeController);
router.post('/register/staff', protect, authorize(USER_ROLES.ADMIN), createStaffController);

export default router;
