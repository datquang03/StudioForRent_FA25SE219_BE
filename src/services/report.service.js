import Report from '../models/Report/report.model.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { Booking, Studio } from '../models/index.js';
import Review from '../models/Review/review.model.js';
import Comment from '../models/Comment/comment.model.js';
import { validateStatusTransition, REPORT_TRANSITIONS } from '../utils/validators.js';
import logger from '../utils/logger.js';
import Payment from '../models/Payment/payment.model.js';
import payos from '../config/payos.js';
import crypto from 'crypto';
import { 
    REPORT_TARGET_TYPES, 
    REPORT_ISSUE_TYPE, 
    REPORT_STATUS, 
    USER_ROLES,
    TARGET_MODEL,
    PAYMENT_CATEGORY,
    PAYMENT_STATUS,
    PAY_TYPE
} from '../utils/constants.js';

export const createReport = async (data) => {
  try {
    // Validate required fields
    if (!data.reporterId) {
      throw new ValidationError('ID người báo cáo là bắt buộc');
    }
    
    // Handle targetType and targetId
    if (!data.targetType) {
      // Backward compatibility: if bookingId is present, assume Booking target
      if (data.bookingId) {
        data.targetType = REPORT_TARGET_TYPES.BOOKING;
        data.targetId = data.bookingId;
      } else {
        throw new ValidationError('Loại đối tượng báo cáo là bắt buộc');
      }
    }

    if (!data.targetId) {
      throw new ValidationError('ID đối tượng báo cáo là bắt buộc');
    }

    if (!data.issueType) {
      throw new ValidationError('Loại vấn đề là bắt buộc');
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError('Mô tả vấn đề là bắt buộc');
    }

    // Validate issueType
    const validIssueTypes = Object.values(REPORT_ISSUE_TYPE);
    if (!validIssueTypes.includes(data.issueType)) {
      throw new ValidationError(`Loại vấn đề không hợp lệ. Chọn từ: ${validIssueTypes.join(', ')}`);
    }

    // Validate priority if provided
    if (data.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(data.priority)) {
        throw new ValidationError(`Mức độ ưu tiên không hợp lệ. Chọn từ: ${validPriorities.join(', ')}`);
      }
    }

    // Validate status if provided
    if (data.status) {
      const validStatuses = Object.values(REPORT_STATUS);
      if (!validStatuses.includes(data.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate compensationAmount if provided
    if (data.compensationAmount !== undefined && (isNaN(data.compensationAmount) || data.compensationAmount < 0)) {
      throw new ValidationError('Số tiền bồi thường phải là số không âm');
    }

    // Check if target exists
    let targetExists = false;
    if (data.targetType === REPORT_TARGET_TYPES.BOOKING) {
      const booking = await Booking.findById(data.targetId);
      if (booking) targetExists = true;
      // Sync bookingId for legacy support
      data.bookingId = data.targetId;
    } else if (data.targetType === REPORT_TARGET_TYPES.REVIEW) {
      const review = await Review.findById(data.targetId);
      if (review) targetExists = true;
    } else if (data.targetType === REPORT_TARGET_TYPES.COMMENT) {
      const comment = await Comment.findById(data.targetId);
      if (comment) {
        targetExists = true;
      } else {
        // Search for reply
        const commentWithReply = await Comment.findOne({ 'replies._id': data.targetId });
        if (commentWithReply) {
          targetExists = true;
        }
      }
    } else if (data.targetType === REPORT_TARGET_TYPES.STUDIO) {
      const studio = await Studio.findById(data.targetId);
      if (studio) targetExists = true;
    }

    if (!targetExists) {
      throw new NotFoundError(`${data.targetType} không tồn tại`);
    }

    const report = new Report(data);
    return await report.save();
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error creating report:', error);
    throw new Error('Lỗi khi tạo báo cáo');
  }
};

export const getReports = async (filter = {}, options = {}) => {
  try {
    // Validate status filter if provided
    if (filter.status) {
      const validStatuses = Object.values(REPORT_STATUS);
      if (!validStatuses.includes(filter.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate issueType filter if provided
    if (filter.issueType) {
      const validIssueTypes = Object.values(REPORT_ISSUE_TYPE);
      if (!validIssueTypes.includes(filter.issueType)) {
        throw new ValidationError(`Loại vấn đề không hợp lệ. Chọn từ: ${validIssueTypes.join(', ')}`);
      }
    }

    // Validate priority filter if provided
    if (filter.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(filter.priority)) {
        throw new ValidationError(`Mức độ ưu tiên không hợp lệ. Chọn từ: ${validPriorities.join(', ')}`);
      }
    }

    return await Report.find(filter, null, options)
      .populate('bookingId') // Keep for legacy
      .populate('reporterId', 'fullName email')
      .populate('resolvedBy', 'fullName email')
      .exec();
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error fetching reports:', error);
    throw new Error('Lỗi khi lấy danh sách báo cáo');
  }
};

export const getMyReports = async (userId, filter = {}, options = {}) => {
  try {
    const query = { ...filter, reporterId: userId };
    
    return await Report.find(query, null, options)
      .populate('bookingId')
      .populate('reporterId', 'fullName email')
      .populate('resolvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .exec();
  } catch (error) {
    logger.error(`Error fetching reports for user ${userId}:`, error);
    throw new Error('Lỗi khi lấy danh sách báo cáo của bạn');
  }
};

export const getReportById = async (id, user) => {
  try {
    if (!id) {
      throw new ValidationError('ID báo cáo là bắt buộc');
    }

    const report = await Report.findById(id)
      .populate('bookingId')
      .populate('reporterId', 'fullName email')
      .populate('resolvedBy', 'fullName email')
      .exec();

    if (!report) {
      throw new NotFoundError('Báo cáo không tồn tại');
    }

    // Check permissions: Admin/Staff or Owner
    if (user) {
      const isStaffOrAdmin = [USER_ROLES.ADMIN, USER_ROLES.STAFF].includes(user.role);
      const isOwner = report.reporterId._id.toString() === user._id.toString();

      if (!isStaffOrAdmin && !isOwner) {
        throw new ForbiddenError('Bạn không có quyền xem báo cáo này');
      }
    }

    return report;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }
    logger.error(`Error fetching report with id ${id}:`, error);
    throw new Error('Lỗi khi lấy thông tin báo cáo');
  }
};

export const updateReport = async (id, update) => {
  try {
    if (!id) {
      throw new ValidationError('ID báo cáo là bắt buộc');
    }

    if (!update || Object.keys(update).length === 0) {
      throw new ValidationError('Dữ liệu cập nhật là bắt buộc');
    }

    // Validate status if provided
    if (update.status) {
      const validStatuses = Object.values(REPORT_STATUS);
      if (!validStatuses.includes(update.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate priority if provided
    if (update.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(update.priority)) {
        throw new ValidationError(`Mức độ ưu tiên không hợp lệ. Chọn từ: ${validPriorities.join(', ')}`);
      }
    }

    // Validate compensationAmount if provided
    if (update.compensationAmount !== undefined && (isNaN(update.compensationAmount) || update.compensationAmount < 0)) {
      throw new ValidationError('Số tiền bồi thường phải là số không âm');
    }

    // Validate description if provided
    if (update.description !== undefined && update.description.trim().length === 0) {
      throw new ValidationError('Mô tả không được để trống');
    }

    // Find report first to check current status
    const report = await Report.findById(id);
    if (!report) {
      throw new NotFoundError('Báo cáo không tồn tại');
    }

    // Validate Status Transition
    if (update.status) {
      validateStatusTransition(report.status, update.status, REPORT_TRANSITIONS, 'Report');
    }

    // Apply updates
    Object.keys(update).forEach((key) => {
      report[key] = update[key];
    });

    await report.save();
    
    // Populate for return
    await report.populate([
      { path: 'bookingId' },
      { path: 'reporterId', select: 'fullName email' },
      { path: 'resolvedBy', select: 'fullName email' }
    ]);

    return report;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error(`Error updating report with id ${id}:`, error);
    throw new Error('Lỗi khi cập nhật báo cáo');
  }
};

export const deleteReport = async (id) => {
  try {
    if (!id) {
      throw new ValidationError('ID báo cáo là bắt buộc');
    }

    const report = await Report.findByIdAndDelete(id);
    
    if (!report) {
      throw new NotFoundError('Báo cáo không tồn tại');
    }

    return report;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error(`Error deleting report with id ${id}:`, error);
    throw new Error('Lỗi khi xóa báo cáo');
  }
};

/**
 * Create payment for fine/compensation
 * @param {string} reportId 
 * @param {Object} user 
 */
export const createFinePayment = async (reportId, user) => {
    try {
        const report = await Report.findById(reportId).populate('reporterId');
        if (!report) throw new NotFoundError('Báo cáo không tồn tại');

        // Check compensation
        const amount = report.compensationAmount || 0;
        if (amount <= 0) {
            throw new ValidationError('Báo cáo không có yêu cầu bồi thường (số tiền = 0)');
        }
        
        if (amount < 1000) {
             throw new ValidationError('Số tiền bồi thường quá nhỏ để thanh toán online (< 1000đ)');
        }

        // Check existing payment
        const existingPayment = await Payment.findOne({
            targetId: reportId,
            targetModel: TARGET_MODEL.REPORT,
            status: PAYMENT_STATUS.PENDING
        });

        if (existingPayment) {
            const now = new Date();
            const isExpired = existingPayment.expiresAt && new Date(existingPayment.expiresAt) < now;
            
            if (isExpired) {
                // Mark expired payment as cancelled
                existingPayment.status = PAYMENT_STATUS.CANCELLED;
                existingPayment.gatewayResponse = {
                    ...existingPayment.gatewayResponse,
                    cancelledAt: new Date(),
                    cancelReason: 'Payment link expired'
                };
                await existingPayment.save();
                // Continue to create new payment below
            } else {
                // Still valid, return existing
                return {
                    payment: existingPayment,
                    checkoutUrl: existingPayment.qrCodeUrl,
                    message: 'Link thanh toán phạt cũ vẫn còn hiệu lực'
                };
            }
        }

        // Generate codes
        const timestamp = Date.now();
        const random = crypto.randomBytes(2).readUInt16BE(0) % 1000;
        const payosOrderCode = Number(`${timestamp}${random.toString().padStart(3, '0')}`);
        const paymentCode = `FINE-${timestamp}`;

        // Create PayOS Link
        let checkoutUrl = null;
        let qrCodeUrl = null;
        let gatewayResponse = { orderCode: payosOrderCode, createdAt: new Date() };

        try {
            const description = `Fine Report ${report._id.toString().slice(-6)}`;
            const paymentData = {
                orderCode: payosOrderCode,
                amount: amount,
                description: description.slice(0, 25), // PayOS limit
                items: [{ name: `Fine/Compensation - Report ${report._id}`, quantity: 1, price: amount }],
                returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/report/payment/success?reportId=${reportId}`,
                cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/report/payment/cancel?reportId=${reportId}`
            };

            let paymentLinkResponse;
            if (payos && typeof payos.createPaymentLink === 'function') {
                paymentLinkResponse = await payos.createPaymentLink(paymentData);
            } else if (payos && typeof payos.paymentRequests?.create === 'function') {
                paymentLinkResponse = await payos.paymentRequests.create(paymentData);
            } else {
                logger.warn('PayOS not configured, using mock data');
                paymentLinkResponse = {
                    checkoutUrl: 'http://localhost:3000/mock-fine-payment',
                    qrCode: 'mock-qr-code',
                    paymentLinkId: `mock-link-${Date.now()}`
                };
            }

            if (paymentLinkResponse) {
                checkoutUrl = paymentLinkResponse.checkoutUrl || paymentLinkResponse.data?.checkoutUrl;
                qrCodeUrl = paymentLinkResponse.qrCode || paymentLinkResponse.data?.qrCode;
            }
        } catch (err) {
            logger.error('PayOS Create Fine Error', err);
            throw new Error('Lỗi tạo link thanh toán phạt: ' + err.message);
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const payment = new Payment({
            targetId: reportId,
            targetModel: TARGET_MODEL.REPORT,
            category: PAYMENT_CATEGORY.FINE,
            paymentCode,
            amount,
            payType: PAY_TYPE.FULL,
            status: PAYMENT_STATUS.PENDING,
            transactionId: payosOrderCode.toString(),
            qrCodeUrl: checkoutUrl,
            gatewayResponse,
            expiresAt
        });
        
        await payment.save();

        return {
            payment,
            checkoutUrl,
            qrCode: qrCodeUrl
        };

    } catch (error) {
        logger.error('Create fine payment error:', error);
        throw error;
    }
};
