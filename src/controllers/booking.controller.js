// #region Imports
import asyncHandler from 'express-async-handler';
import {
  createBooking as createBookingService,
  getBookingById as getBookingByIdService,
  getBookings as getBookingsService,
  cancelBooking as cancelBookingService,
  markAsNoShow as markAsNoShowService,
  confirmBooking as confirmBookingService,
  updateBooking as updateBookingService,
  checkInBooking as checkInBookingService,
  checkOutBooking as checkOutBookingService,
  getBookingsForStaff as getBookingsForStaffService,
} from '../services/booking.service.js';
// #endregion

export const createBooking = asyncHandler(async (req, res) => {
  const data = req.body;
  // attach authenticated user if available
  if (!data.userId && req.user) data.userId = req.user._id;

  const { booking, paymentOptions } = await createBookingService(data);

  res.status(201).json({
    success: true,
    message: 'Tạo booking thành công!',
    data: { booking, paymentOptions }
  });
});

export const getBookings = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const userId = req.user ? req.user._id : req.query.userId;

  const result = await getBookingsService({ userId, page, limit, status });
  res.status(200).json({ success: true, message: 'Lấy danh sách bookings thành công!', data: result });
});

export const getBooking = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const userRole = req.user ? req.user.role : null;
  
  const booking = await getBookingByIdService(req.params.id, userId, userRole);
  res.status(200).json({ success: true, message: 'Lấy booking thành công!', data: booking });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBookingService(req.params.id);
  res.status(200).json({ success: true, message: 'Hủy booking thành công!', data: booking });
});

export const markAsNoShow = asyncHandler(async (req, res) => {
  const { checkInTime } = req.body;
  const booking = await markAsNoShowService(req.params.id, checkInTime, req.io);
  res.status(200).json({ success: true, message: 'Đánh dấu no-show thành công!', data: booking });
});

export const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await confirmBookingService(req.params.id);
  res.status(200).json({ success: true, message: 'Xác nhận booking thành công!', data: booking });
});

export const updateBooking = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const data = req.body;
  const actorId = req.user ? req.user._id : null;
  const actorRole = req.user ? req.user.role : null;

  const updated = await updateBookingService(bookingId, data, actorId, actorRole);

  res.status(200).json({ success: true, message: 'Cập nhật booking thành công!', data: updated });
});

export const checkIn = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const actorId = req.user ? req.user._id : null;

  const booking = await checkInBookingService(bookingId, actorId);
  res.status(200).json({ success: true, message: 'Check-in thành công!', data: booking });
});

export const checkOut = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const actorId = req.user ? req.user._id : null;

  const booking = await checkOutBookingService(bookingId, actorId);
  res.status(200).json({ success: true, message: 'Check-out thành công!', data: booking });
});

export const getActiveBookingsForStaff = asyncHandler(async (req, res) => {
  const { page, limit, status, startDate, endDate, includeAll } = req.query;

  // Validate pagination parameters
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  
  if (page && (isNaN(parsedPage) || parsedPage < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page parameter. Must be a positive integer.'
    });
  }
  
  if (limit && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid limit parameter. Must be between 1 and 200.'
    });
  }

  const result = await getBookingsForStaffService({
    page: parsedPage || 1,
    limit: parsedLimit || 20,
    status,
    startDate,
    endDate,
    includeAll: includeAll === 'true' || includeAll === true
  });

  const message = includeAll ? 'Lấy danh sách tất cả bookings thành công!' : 'Lấy danh sách booking đang hoạt động thành công!';
  
  res.status(200).json({
    success: true,
    message,
    data: result
  });
});

export default {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
  checkIn,
  checkOut,
  getActiveBookingsForStaff,
};
