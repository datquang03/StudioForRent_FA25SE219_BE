import Report from '../models/Report/report.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { Booking } from '../models/index.js';

export const createReport = async (data) => {
  try {
    // Validate required fields
    if (!data.reporterId) {
      throw new ValidationError('ID người báo cáo là bắt buộc');
    }
    if (!data.bookingId) {
      throw new ValidationError('ID booking là bắt buộc');
    }
    if (!data.issueType) {
      throw new ValidationError('Loại vấn đề là bắt buộc');
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError('Mô tả vấn đề là bắt buộc');
    }

    // Validate issueType
    const validIssueTypes = ['DAMAGE', 'COMPLAINT', 'MISSING_ITEM', 'OTHER'];
    if (!validIssueTypes.includes(data.issueType)) {
      throw new ValidationError(`Loại vấn đề không hợp lệ. Chọn từ: ${validIssueTypes.join(', ')}`);
    }

    // Validate priority if provided
    if (data.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(data.priority)) {
        throw new ValidationError(`Mức độ ưu tiên không hợp lệ. Chọn từ: ${validPriorities.join(', ')}`);
      }
    }

    // Validate status if provided
    if (data.status) {
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!validStatuses.includes(data.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate compensationAmount if provided
    if (data.compensationAmount !== undefined && (isNaN(data.compensationAmount) || data.compensationAmount < 0)) {
      throw new ValidationError('Số tiền bồi thường phải là số không âm');
    }

    // Check if booking exists
    const booking = await Booking.findById(data.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking không tồn tại');
    }

    const report = new Report(data);
    return await report.save();
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    console.error('Error creating report:', error);
    throw new Error('Lỗi khi tạo báo cáo');
  }
};

export const getReports = async (filter = {}, options = {}) => {
  try {
    // Validate status filter if provided
    if (filter.status) {
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!validStatuses.includes(filter.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate issueType filter if provided
    if (filter.issueType) {
      const validIssueTypes = ['DAMAGE', 'COMPLAINT', 'MISSING_ITEM', 'OTHER'];
      if (!validIssueTypes.includes(filter.issueType)) {
        throw new ValidationError(`Loại vấn đề không hợp lệ. Chọn từ: ${validIssueTypes.join(', ')}`);
      }
    }

    // Validate priority filter if provided
    if (filter.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(filter.priority)) {
        throw new ValidationError(`Mức độ ưu tiên không hợp lệ. Chọn từ: ${validPriorities.join(', ')}`);
      }
    }

    return await Report.find(filter, null, options)
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    console.error('Error fetching reports:', error);
    throw new Error('Lỗi khi lấy danh sách báo cáo');
  }
};

export const getReportById = async (id) => {
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

    return report;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error fetching report with id ${id}:`, error);
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
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!validStatuses.includes(update.status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
    }

    // Validate priority if provided
    if (update.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
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
    console.error(`Error updating report with id ${id}:`, error);
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
    console.error(`Error deleting report with id ${id}:`, error);
    throw new Error('Lỗi khi xóa báo cáo');
  }
};
