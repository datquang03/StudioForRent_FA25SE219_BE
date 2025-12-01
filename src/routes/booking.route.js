import express from 'express';
import {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  markAsNoShow,
  confirmBooking,
  updateBooking,
  checkIn,
  checkOut,
  getActiveBookingsForStaff,
} from '../controllers/booking.controller.js';
import { createBookingDetailsController } from '../controllers/bookingDetail.controller.js';
import { protect, authorize } from '../middlewares/auth.js';
import { sanitizeInput, validateObjectId } from '../middlewares/validate.js';
import { generalLimiter, userLimiter, bookingLimiter } from '../middlewares/rateLimiter.js';
import { USER_ROLES } from '../utils/constants.js';

const router = express.Router();

router.use(sanitizeInput);
router.use(generalLimiter);

// All booking routes require authentication
router.use(protect);
router.use(userLimiter); // Apply per-user rate limiting

// Customer routes
router.post('/', authorize(USER_ROLES.CUSTOMER), bookingLimiter, createBooking);
router.get('/', authorize(USER_ROLES.CUSTOMER), getBookings);
router.get('/:id', validateObjectId(), authorize(USER_ROLES.CUSTOMER), getBooking);
router.post('/:id/details', validateObjectId(), authorize(USER_ROLES.CUSTOMER), createBookingDetailsController);
router.post('/:id/cancel', validateObjectId(), authorize(USER_ROLES.CUSTOMER), cancelBooking);

// Staff/Admin routes
router.patch('/:id', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), updateBooking);
router.get('/:id', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getBooking);
router.post('/:id/confirm', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), confirmBooking);
router.post('/:id/no-show', validateObjectId(), authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), markAsNoShow);
// Check-in / Check-out (only staff allowed)
router.post('/:id/checkin', validateObjectId(), authorize(USER_ROLES.STAFF), checkIn);
router.post('/:id/checkout', validateObjectId(), authorize(USER_ROLES.STAFF), checkOut);

// Staff routes for managing bookings
router.get('/staff', authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN), getActiveBookingsForStaff);

export default router;
