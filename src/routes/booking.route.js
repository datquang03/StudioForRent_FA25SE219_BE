import express from 'express';
import {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
} from '../controllers/booking.controller.js';
import { createBookingDetailsController } from '../controllers/bookingDetail.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.use(sanitizeInput);
router.use(generalLimiter);

// All booking routes require authentication
router.use(protect);

// Customer routes
router.post('/', authorize(USER_ROLES.CUSTOMER), createBooking);
router.get('/', authorize(USER_ROLES.CUSTOMER), getBookings);
router.get('/:id', validateObjectId(), authorize(USER_ROLES.CUSTOMER), getBooking);
router.post('/:id/details', validateObjectId(), authorize(USER_ROLES.CUSTOMER), createBookingDetailsController);
 router.patch('/:id', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateBooking);
router.post('/:id/cancel', validateObjectId(), authorize(USER_ROLES.CUSTOMER), cancelBooking);

// Staff/Admin action to confirm a booking
router.post('/:id/confirm', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), confirmBooking);

export default router;
