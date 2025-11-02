import express from 'express';
import {
  getProfile,
  updateProfile,
  deleteAccount,
} from '../controllers/customer.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.use(protect);
router.use(authorize(USER_ROLES.CUSTOMER));

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.delete('/profile', deleteAccount);

export default router;
