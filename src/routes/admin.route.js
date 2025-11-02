import express from 'express';
import {
  getCustomers,
  getCustomer,
  banCustomer,
  unbanCustomer,
  getStaffList,
  getStaff,
  updateStaff,
  deactivateStaff,
  activateStaff,
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.use(protect);
router.use(authorize(USER_ROLES.ADMIN));

router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomer);
router.patch('/customers/:id/ban', banCustomer);
router.patch('/customers/:id/unban', unbanCustomer);

router.get('/staff', getStaffList);
router.get('/staff/:id', getStaff);
router.patch('/staff/:id', updateStaff);
router.patch('/staff/:id/deactivate', deactivateStaff);
router.patch('/staff/:id/activate', activateStaff);

export default router;
