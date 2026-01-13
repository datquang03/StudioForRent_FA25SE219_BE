//#region Imports
import { 
  createPaymentOptions, 
  handlePaymentWebhook, 
  getPaymentStatus, 
  syncPaymentWithPayOS,
  createPaymentForRemaining, 
  getStaffPaymentHistory, 
  createPaymentForOption,
  formatPaymentOption,
  getMyTransactions,
  getAllTransactions,
  getTransactionById,
  deleteTransaction,
  deleteAllCancelledTransactions,
  getTransactionHistory
} from '../services/payment.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import Payment from '../models/Payment/payment.model.js';
import Booking from '../models/Booking/booking.model.js';
import Schedule from '../models/Schedule/schedule.model.js';
import { USER_ROLES } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { isValidObjectId, isPositiveNumber } from '../utils/validators.js';
//#endregion

/**
 * Create payment options for booking
 * POST /api/payments/options/:bookingId
 */
export const createPaymentOptionsController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId || !isValidObjectId(bookingId)) {
      throw new ValidationError('ID booking không hợp lệ');
    }

    const paymentOptions = await createPaymentOptions(bookingId);

    res.status(200).json({
      success: true,
      message: 'Tạo tùy chọn thanh toán thành công',
      data: paymentOptions
    });
  } catch (error) {
    logger.error('Create remaining payment error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * PayOS webhook handler
 * POST /api/payments/webhook
 */
export const paymentWebhookController = async (req, res) => {
  try {
    // Pass both body and headers to the service so it can verify header signatures too
    const webhookPayload = { body: req.body, headers: req.headers };
    await handlePaymentWebhook(webhookPayload);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Payment webhook error:', error);
    // In development return the error message for easier debugging
    const msg = (process.env.NODE_ENV || 'development') === 'production' ? 'Xử lý webhook thất bại' : (error.message || 'Xử lý webhook thất bại');
    res.status(500).json({ success: false, message: msg });
  }
};

/**
 * Get payment status
 * GET /api/payments/:paymentId
 */
export const getPaymentStatusController = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId || !isValidObjectId(paymentId)) {
      throw new ValidationError('ID thanh toán không hợp lệ');
    }

    // Use syncPaymentWithPayOS to actively check and update status if pending
    const payment = await syncPaymentWithPayOS(paymentId);

    // Ensure booking still exists for this payment
    if (!payment.bookingId) {
      throw new NotFoundError('Không tìm thấy booking cho thanh toán này');
    }

    // Format response to include remainingAmount
    const formattedPayment = formatPaymentOption(payment, payment.bookingId.finalAmount);

    res.status(200).json({
      success: true,
      data: formattedPayment
    });
  } catch (error) {
    logger.error('Get payment status error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Create a single payment for selected option
 * POST /api/payments/create/:bookingId
 */
export const createSinglePaymentController = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { percentage, payType } = req.body;

    if (!bookingId || !isValidObjectId(bookingId)) {
      throw new ValidationError('ID booking không hợp lệ');
    }

    // Either percentage or payType must be provided
    if (!percentage && !payType) {
      throw new ValidationError('Phần trăm hoặc loại thanh toán là bắt buộc');
    }

    const payment = await createPaymentForOption(bookingId, { percentage, payType });

    res.status(200).json({ success: true, message: 'Payment created', data: payment });
  } catch (error) {
    logger.error('Create single payment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

/**
 * Create payment for remaining amount after deposit
 * POST /api/payments/remaining/:bookingId
 */
export const createRemainingPaymentController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Ensure booking exists and enforce ownership for customers
    const booking = await Booking.findById(bookingId).select('userId');
    if (!booking) throw new NotFoundError('Booking not found');

    if (req.user && req.user.role === USER_ROLES.CUSTOMER) {
      if (!booking.userId || booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Không có quyền: không phải chủ sở hữu booking' });
      }
    }

    // Pass actorId for audit (who created the remaining payment)
    const payment = await createPaymentForRemaining(bookingId, { actorId: req.user?._id });

    res.status(200).json({ success: true, message: 'Tạo thanh toán số tiền còn lại thành công', data: payment });
  } catch (error) {
    logger.error('Create remaining payment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * Get payment history for customer
 * GET /api/payments/history
 */
export const getCustomerPaymentHistoryController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // Build query to get payments through user's bookings
    let bookingQuery = { userId };
    if (startDate || endDate) {
      bookingQuery.createdAt = {};
      if (startDate) bookingQuery.createdAt.$gte = new Date(startDate);
      if (endDate) bookingQuery.createdAt.$lte = new Date(endDate);
    }

    const userBookings = await Booking.find(bookingQuery).select('_id');
    const bookingIds = userBookings.map(b => b._id);

    let paymentQuery = { bookingId: { $in: bookingIds } };
    if (status) paymentQuery.status = status;

    const payments = await Payment.find(paymentQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Payment.countDocuments(paymentQuery);

    // Batch load booking data for all payments
    const paymentBookingIds = payments.map(p => p.bookingId);
    const bookings = await Booking.find({ _id: { $in: paymentBookingIds } })
      .populate({
        path: 'scheduleId',
        select: 'startTime endTime',
        populate: {
          path: 'studioId',
          select: 'name location'
        }
      })
      .select('status totalBeforeDiscount finalAmount scheduleId createdAt')
      .lean();

    // Create lookup map
    const bookingMap = new Map(bookings.map(b => [b._id.toString(), b]));

    // Combine payment data with booking data
    const enrichedPayments = payments.map(payment => ({
      ...payment,
      booking: bookingMap.get(payment.bookingId?.toString()) || null
    }));

    res.status(200).json({
      success: true,
      data: {
        payments: enrichedPayments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get customer payment history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Get payment history for staff/admin
 * GET /api/payments/staff/history
 */
export const getStaffPaymentHistoryController = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, studioId } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new ValidationError('Tham số phân trang không hợp lệ');
    }

    // Validate dates if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Định dạng ngày bắt đầu không hợp lệ');
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Định dạng ngày kết thúc không hợp lệ');
    }

    // Validate studioId if provided
    if (studioId && !isValidObjectId(studioId)) {
      throw new ValidationError('ID studio không hợp lệ');
    }

    const result = await getStaffPaymentHistory({
      status,
      studioId,
      startDate,
      endDate,
      page: pageNum,
      limit: limitNum
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get staff payment history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * @deprecated This endpoint is deprecated. Use POST /api/bookings/:id/refund-request instead.
 * POST /api/payments/:paymentId/refund
 * Body: { bankName, accountNumber, accountName } (NEW), old params will throw error
 */
export const createRefundController = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason, bankCode, accountNumber } = req.body;
    const actorId = req.user._id;

    // Validate paymentId
    if (!paymentId || !isValidObjectId(paymentId)) {
      throw new ValidationError('ID thanh toán không hợp lệ');
    }

    // Validate bank info (required for manual bank transfer)
    if (!bankCode || typeof bankCode !== 'string' || bankCode.trim().length === 0) {
      throw new ValidationError('Mã ngân hàng (bankCode) là bắt buộc');
    }
    if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.trim().length === 0) {
      throw new ValidationError('Số tài khoản (accountNumber) là bắt buộc');
    }

    // Validate amount if provided
    if (amount !== undefined) {
      if (!isPositiveNumber(amount)) {
        throw new ValidationError('Số tiền hoàn lại phải là số dương');
      }
    }

    // Validate reason
    if (reason && (typeof reason !== 'string' || reason.trim().length === 0)) {
      throw new ValidationError('Lý do hoàn tiền không được để trống');
    }

    // Validate actorId
    if (!actorId || !isValidObjectId(actorId)) {
      throw new ValidationError('Xác thực người dùng không hợp lệ');
    }

    // Import refund service function
    const { createRefund } = await import('../services/refund.service.js');
    const refund = await createRefund(paymentId, { 
      amount, 
      reason, 
      actorId,
      bankCode: bankCode.trim(),
      accountNumber: accountNumber.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Tạo yêu cầu hoàn tiền thành công',
      data: refund
    });
  } catch (error) {
    logger.error('Create refund error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Get refund status
 * GET /api/payments/:paymentId/refund
 */
export const getRefundStatusController = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Import Refund service
    const { getRefundsForPayment } = await import('../services/refund.service.js');
    const refunds = await getRefundsForPayment(paymentId);

    res.status(200).json({
      success: true,
      data: refunds // Return all refunds as an array (empty if none)
    });
  } catch (error) {
    logger.error('Get refund status error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Get my transactions (for customers)
 * GET /api/payments/my-transactions
 */
export const getMyTransactionsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, startDate, endDate, page, limit } = req.query;

    const result = await getMyTransactions(userId, {
      status,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.status(200).json({
      success: true,
      message: 'Lấy lịch sử giao dịch thành công',
      data: result
    });
  } catch (error) {
    logger.error('Get my transactions error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy lịch sử giao dịch'
    });
  }
};

/**
 * Get all transactions (for staff/admin)
 * GET /api/payments/transactions
 */
export const getAllTransactionsController = async (req, res) => {
  try {
    const { status, payType, bookingId, userId, startDate, endDate, minAmount, maxAmount, page, limit } = req.query;

    const result = await getAllTransactions({
      status,
      payType,
      bookingId,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.status(200).json({
      success: true,
      message: 'Lấy tất cả giao dịch thành công',
      data: result
    });
  } catch (error) {
    logger.error('Get all transactions error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy tất cả giao dịch'
    });
  }
};

/**
 * Get transaction by ID
 * GET /api/payments/transactions/:transactionId
 */
export const getTransactionByIdController = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!transactionId || !isValidObjectId(transactionId)) {
      throw new ValidationError('ID giao dịch không hợp lệ');
    }

    const transaction = await getTransactionById(transactionId, userId, userRole);

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết giao dịch thành công',
      data: transaction
    });
  } catch (error) {
    logger.error('Get transaction by ID error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy chi tiết giao dịch'
    });
  }
};

/**
 * Delete transaction (staff/admin only)
 * DELETE /api/payments/transactions/:transactionId
 */
export const deleteTransactionController = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId || !isValidObjectId(transactionId)) {
      throw new ValidationError('ID giao dịch không hợp lệ');
    }

    const deletedTransaction = await deleteTransaction(transactionId);

    res.status(200).json({
      success: true,
      message: 'Xóa giao dịch thành công',
      data: deletedTransaction
    });
  } catch (error) {
    logger.error('Delete transaction error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi xóa giao dịch'
    });
  }
};

/**
 * Delete all cancelled transactions (staff/admin only)
 * DELETE /api/payments/transactions
 */
export const deleteAllTransactionsController = async (req, res) => {
  try {
    const { beforeDate, bookingId } = req.query;

    const result = await deleteAllCancelledTransactions({
      beforeDate,
      bookingId
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    logger.error('Delete all transactions error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi xóa các giao dịch'
    });
  }
};

/**
 * Get transaction history with statistics
 * GET /api/payments/transaction-history
 */
export const getTransactionHistoryController = async (req, res) => {
  try {
    const { userId, startDate, endDate, status, groupBy, page, limit } = req.query;
    const userRole = req.user.role;
    const currentUserId = req.user._id;

    // If customer, only allow viewing own history
    const targetUserId = userRole === USER_ROLES.CUSTOMER ? currentUserId : userId;

    const result = await getTransactionHistory({
      userId: targetUserId,
      startDate,
      endDate,
      status,
      groupBy,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.status(200).json({
      success: true,
      message: 'Lấy lịch sử giao dịch thành công',
      data: result
    });
  } catch (error) {
    logger.error('Get transaction history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy lịch sử giao dịch'
    });
  }
};