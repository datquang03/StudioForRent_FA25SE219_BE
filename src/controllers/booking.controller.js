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
  getMaxExtensionTime as getMaxExtensionTimeService,
  extendBooking as extendBookingService,
} from '../services/booking.service.js';
// #endregion

export const createBooking = asyncHandler(async (req, res) => {
  const data = req.body;
  // attach authenticated user if available
  if (!data.userId && req.user) data.userId = req.user._id;

  const result = await createBookingService(data);
  
  // Service returns { booking, paymentOptions }
  const { booking, paymentOptions } = result;

  res.status(201).json({
    success: true,
    message: 'Tạo booking thành công!',
    data: { booking, paymentOptions }
  });
});

export const getBookings = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  
  let userId;
  // If customer, force filter by their own ID
  if (req.user && req.user.role === 'customer') {
    userId = req.user._id;
  } else {
    // For staff/admin, allow filtering by specific userId if provided in query, otherwise get all
    userId = req.query.userId;
  }

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

// #region Extension Controllers

export const getExtensionOptions = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const result = await getMaxExtensionTimeService(bookingId);

  res.status(200).json({
    success: true,
    message: result.canExtend 
      ? `Có thể gia hạn tối đa ${result.availableMinutes} phút`
      : result.reason,
    data: result
  });
});

export const extendBookingController = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const { newEndTime } = req.body;
  const actorId = req.user ? req.user._id : null;

  if (!newEndTime) {
    res.status(400);
    throw new Error('Vui lòng cung cấp thời gian kết thúc mới (newEndTime)');
  }

  const result = await extendBookingService(bookingId, newEndTime, actorId);

  res.status(200).json({
    success: true,
    message: `Gia hạn booking thành công! Số tiền cần thanh toán thêm: ${result.additionalAmount.toLocaleString('vi-VN')} VND`,
    data: result
  });
});

// #endregion

export default {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
  checkIn,
  checkOut,
  getExtensionOptions,
  extendBookingController,
};
