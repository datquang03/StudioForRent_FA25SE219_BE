// #region Imports
import asyncHandler from 'express-async-handler';
import {
  createBooking as createBookingService,
  getBookingById as getBookingByIdService,
  getBookings as getBookingsService,
  cancelBooking as cancelBookingService,
  confirmBooking as confirmBookingService,
  updateBooking as updateBookingService,
} from '../services/booking.service.js';
// #endregion

export const createBooking = asyncHandler(async (req, res) => {
  const data = req.body;
  // attach authenticated user if available
  if (!data.userId && req.user) data.userId = req.user._id;

  const booking = await createBookingService(data);
  res.status(201).json({ success: true, message: 'Tạo booking thành công!', data: booking });
});

export const getBookings = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const userId = req.user ? req.user._id : req.query.userId;

  const result = await getBookingsService({ userId, page, limit, status });
  res.status(200).json({ success: true, message: 'Lấy danh sách bookings thành công!', data: result });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await getBookingByIdService(req.params.id);
  res.status(200).json({ success: true, message: 'Lấy booking thành công!', data: booking });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBookingService(req.params.id);
  res.status(200).json({ success: true, message: 'Hủy booking thành công!', data: booking });
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

export default {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
};
