import asyncHandler from 'express-async-handler';
import { createBookingDetails } from '../services/bookingDetail.service.js';
import Booking from '../models/Booking/booking.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export const createBookingDetailsController = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const details = req.body.details;
  const userId = req.user && req.user._id;

  if (!details || !Array.isArray(details) || details.length === 0) {
    res.status(400);
    throw new ValidationError('Chi tiết là bắt buộc và phải là mảng không rỗng');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    res.status(404);
    throw new NotFoundError('Booking không tồn tại');
  }

  // Ensure owner (customers can only modify their own booking)
  if (String(booking.userId) !== String(userId)) {
    res.status(403);
    throw new ValidationError('Không có quyền chỉnh sửa booking này');
  }

  const result = await createBookingDetails(bookingId, details);

  // Recalculate totals and update booking
  booking.totalBeforeDiscount += result.total;
  
  // Recalculate discountAmount if discountPercent is present
  if (booking.discountPercent) {
    booking.discountAmount = Math.round(booking.totalBeforeDiscount * (booking.discountPercent / 100) * 100) / 100;
  } else {
    booking.discountAmount = booking.discountAmount || 0;
  }
  
  booking.finalAmount = Math.max(0, booking.totalBeforeDiscount - booking.discountAmount);
  await booking.save();

  res.status(201).json({ success: true, message: 'Thêm chi tiết booking thành công', data: result });
});

export default {
  createBookingDetailsController,
};
