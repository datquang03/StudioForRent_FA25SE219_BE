import Report from '../models/Report/report.model.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { Booking } from '../models/index.js';
import Review from '../models/Review/review.model.js';
import Comment from '../models/Comment/comment.model.js';
import { REPORT_TARGET_TYPES, REPORT_ISSUE_TYPE, REPORT_STATUS, USER_ROLES } from '../utils/constants.js';
import logger from '../utils/logger.js';

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
      if (comment) targetExists = true;
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
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error fetching reports:', error);
    throw new Error('Lỗi khi lấy danh sách báo cáo');
  }
};

export const getReportById = async (id, user) => {
  try {
    if (!id) {
      throw new ValidationError('ID báo cáo là bắt buộc');
    }

    const report = await Report.findById(id)
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
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

    const report = await Report.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();

    if (!report) {
      throw new NotFoundError('Báo cáo không tồn tại');
    }

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
