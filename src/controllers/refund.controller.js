import asyncHandler from 'express-async-handler';
import { isValidObjectId } from 'mongoose';
import { ValidationError } from '../utils/errors.js';
import {
  createRefundRequest,
  approveRefund,
  rejectRefund,
  getPendingRefunds,
  getApprovedRefunds,
  confirmManualRefund,
  getRefundById,
  getRefundsForBooking,
  getMyRefunds,
  getAllRefunds
} from '../services/refund.service.js';
import { uploadImage } from '../services/upload.service.js';

/**
 * Create refund request for a booking (Customer)
 * POST /api/bookings/:id/refund-request
 */
export const createRefundRequestController = asyncHandler(async (req, res) => {
  const { id: bookingId } = req.params;
  const { bankName, accountNumber, accountName, reason } = req.body;
  const userId = req.user._id;

  if (!bookingId || !isValidObjectId(bookingId)) {
    throw new ValidationError('Booking ID không hợp lệ');
  }

  if (!bankName || typeof bankName !== 'string' || bankName.trim().length === 0) {
    throw new ValidationError('Tên ngân hàng (bankName) là bắt buộc');
  }

  if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.trim().length === 0) {
    throw new ValidationError('Số tài khoản (accountNumber) là bắt buộc');
  }

  if (!accountName || typeof accountName !== 'string' || accountName.trim().length === 0) {
    throw new ValidationError('Tên chủ tài khoản (accountName) là bắt buộc');
  }

  const refund = await createRefundRequest(bookingId, {
    bankName: bankName.trim(),
    accountNumber: accountNumber.trim(),
    accountName: accountName.trim(),
    reason: reason ? reason.trim() : null,
    userId
  });

  res.status(201).json({
    success: true,
    message: 'Yêu cầu hoàn tiền đã được tạo, đang chờ phê duyệt',
    data: refund
  });
});

/**
 * Get all pending refund requests (Staff/Admin)
 * GET /api/refunds/pending
 */
export const getPendingRefundsController = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await getPendingRefunds(page, limit);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Approve a pending refund request (Staff/Admin)
 * POST /api/refunds/:refundId/approve
 */
export const approveRefundController = asyncHandler(async (req, res) => {
  const { refundId } = req.params;
  const staffId = req.user._id;

  if (!refundId || !isValidObjectId(refundId)) {
    throw new ValidationError('Refund ID không hợp lệ');
  }

  const refund = await approveRefund(refundId, staffId);

  res.status(200).json({
    success: true,
    message: 'Yêu cầu hoàn tiền đã được phê duyệt và đang xử lý',
    data: refund
  });
});

/**
 * Reject a pending refund request (Staff/Admin)
 * POST /api/refunds/:refundId/reject
 */
export const rejectRefundController = asyncHandler(async (req, res) => {
  const { refundId } = req.params;
  const { reason } = req.body;
  const staffId = req.user._id;

  if (!refundId || !isValidObjectId(refundId)) {
    throw new ValidationError('Refund ID không hợp lệ');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new ValidationError('Lý do từ chối là bắt buộc');
  }

  const refund = await rejectRefund(refundId, staffId, reason.trim());

  res.status(200).json({
    success: true,
    message: 'Yêu cầu hoàn tiền đã bị từ chối',
    data: refund
  });
});

/**
 * Get refund details
 * GET /api/refunds/:refundId
 * Customers can only view their own refunds, Staff/Admin can view all
 */
export const getRefundDetailController = asyncHandler(async (req, res) => {
  const { refundId } = req.params;

  if (!refundId || !isValidObjectId(refundId)) {
    throw new ValidationError('Refund ID không hợp lệ');
  }

  const refund = await getRefundById(refundId);

  if (!refund) {
    throw new ValidationError('Không tìm thấy yêu cầu hoàn tiền');
  }

  // Security check: customers can only view their own refunds
  const userRole = req.user.role;
  const userId = req.user._id.toString();
  const refundRequestedBy = refund.requestedBy?._id?.toString() || refund.requestedBy?.toString();

  if (userRole === 'customer' && refundRequestedBy !== userId) {
    throw new ValidationError('Bạn không có quyền xem yêu cầu hoàn tiền này');
  }

  res.status(200).json({
    success: true,
    data: refund
  });
});

/**
 * Get refunds for a booking
 * GET /api/bookings/:bookingId/refunds
 */
export const getRefundsForBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId || !isValidObjectId(bookingId)) {
    throw new ValidationError('Booking ID không hợp lệ');
  }

  const refunds = await getRefundsForBooking(bookingId);

  res.status(200).json({
    success: true,
    data: refunds
  });
});

/**
 * Get my refund requests (Customer)
 * GET /api/refunds/my-requests
 */
export const getMyRefundsController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await getMyRefunds(userId, page, limit);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Get all refunds with filters (Staff/Admin)
 * GET /api/refunds
 * Query params: status, bookingId, userId, startDate, endDate, minAmount, maxAmount, page, limit
 */
export const getAllRefundsController = asyncHandler(async (req, res) => {
  const {
    status,
    bookingId,
    userId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    page,
    limit
  } = req.query;

  // Validate bookingId if provided
  if (bookingId && !isValidObjectId(bookingId)) {
    throw new ValidationError('Booking ID không hợp lệ');
  }

  // Validate userId if provided
  if (userId && !isValidObjectId(userId)) {
    throw new ValidationError('User ID không hợp lệ');
  }

  const result = await getAllRefunds({
    status,
    bookingId,
    userId,
    startDate,
    endDate,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Get all approved refunds waiting for manual transfer (Staff/Admin)
 * GET /api/refunds/approved
 */
export const getApprovedRefundsController = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await getApprovedRefunds(page, limit);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Confirm manual refund transfer completed (Staff/Admin)
 * POST /api/refunds/:refundId/confirm
 * Supports multipart/form-data with optional proof image upload
 */
export const confirmManualRefundController = asyncHandler(async (req, res) => {
  const { refundId } = req.params;
  const { transactionRef, note } = req.body || {}; // Handle undefined req.body in multipart/form-data
  const staffId = req.user._id;

  if (!refundId || !isValidObjectId(refundId)) {
    throw new ValidationError('Refund ID không hợp lệ');
  }

  // Handle proof image upload if provided
  let proofImageUrl = null;
  if (req.file) {
    const uploadResult = await uploadImage(req.file, {
      folder: 'studio-rental/refund-proofs'
    });
    proofImageUrl = uploadResult.url;
  }

  const refund = await confirmManualRefund(refundId, staffId, { 
    transactionRef, 
    note, 
    proofImageUrl 
  });

  res.status(200).json({
    success: true,
    message: 'Đã xác nhận hoàn tiền thành công',
    data: refund
  });
});
