// #region Imports
import { Schedule } from '../models/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { SCHEDULE_STATUS } from '../utils/constants.js';
// #endregion

export const createSchedule = async (data, session = null) => {
  try {
    const { studioId, startTime, endTime } = data;

    // Validate required fields
    if (!studioId || !startTime || !endTime) {
      throw new ValidationError('ID studio, thời gian bắt đầu và thời gian kết thúc là bắt buộc');
    }

    // Validate date formats
    const s = new Date(startTime);
    const e = new Date(endTime);
    
    if (isNaN(s.getTime())) {
      throw new ValidationError('Thời gian bắt đầu không hợp lệ');
    }
    if (isNaN(e.getTime())) {
      throw new ValidationError('Thời gian kết thúc không hợp lệ');
    }

    // Validate time range
    if (!(e > s)) {
      throw new ValidationError('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
    }

    // Validate not in the past (allow 1 minute buffer for clock skew/latency)
    const now = new Date();
    const bufferMs = 60 * 1000; // 1 minute buffer
    if (s.getTime() < (now.getTime() - bufferMs)) {
      throw new ValidationError('Thời gian bắt đầu không được ở quá khứ');
    }

    // Validate minimum duration (e.g., 1 hour)
    const MIN_DURATION_MS = 60 * 60 * 1000; // 1 hour
    if ((e.getTime() - s.getTime()) < MIN_DURATION_MS) {
      throw new ValidationError('Thời gian thuê tối thiểu là 1 giờ');
    }

    // Validate status if provided
    if (data.status && !Object.values(SCHEDULE_STATUS).includes(data.status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(SCHEDULE_STATUS).join(', ')}`);
    }

    // Minimum gap between schedules (30 minutes)
    const MIN_GAP_MS = 30 * 60 * 1000; // 30 minutes in ms

    // Prevent overlapping schedules and enforce minimum gap for the same studio
    const conflict = await Schedule.findOne({
      studioId,
      startTime: { $lt: new Date(e.getTime() + MIN_GAP_MS) },
      endTime: { $gt: new Date(s.getTime() - MIN_GAP_MS) },
    });

    if (conflict) {
      throw new ConflictError('Lịch bị trùng hoặc quá gần với lịch đã có (khoảng cách tối thiểu 30 phút)');
    }

    let schedule;
    if (session) {
      const [doc] = await Schedule.create(
        [
          {
            studioId,
            startTime: s,
            endTime: e,
            status: data.status || SCHEDULE_STATUS.AVAILABLE,
          },
        ],
        { session },
      );
      schedule = doc;
    } else {
      schedule = await Schedule.create({
        studioId,
        startTime: s,
        endTime: e,
        status: data.status || SCHEDULE_STATUS.AVAILABLE,
      });
    }

    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo lịch');
  }
};

export const getScheduleById = async (id) => {
  try {
    if (!id) {
      throw new ValidationError('ID lịch là bắt buộc');
    }

    const schedule = await Schedule.findById(id).lean();
    if (!schedule) {
      throw new NotFoundError('Lịch không tồn tại');
    }
    
    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin lịch');
  }
};

export const getSchedules = async ({ studioId, status, page = 1, limit = 20 } = {}) => {
  try {
    // Validate page and limit
    const safePage = Math.max(parseInt(page) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 200);

    // Validate status if provided
    if (status && !Object.values(SCHEDULE_STATUS).includes(status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(SCHEDULE_STATUS).join(', ')}`);
    }

    const query = {};
    if (studioId) query.studioId = studioId;
    if (status) query.status = status;

    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      Schedule.find(query).sort({ startTime: 1 }).skip(skip).limit(safeLimit).lean(),
      Schedule.countDocuments(query),
    ]);

    return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy danh sách lịch');
  }
};

export const updateSchedule = async (id, updateData, session = null) => {
  try {
    if (!id) {
      throw new ValidationError('ID lịch là bắt buộc');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new ValidationError('Dữ liệu cập nhật là bắt buộc');
    }

    const query = Schedule.findById(id);
    if (session) query.session(session);
    const schedule = await query;
    
    if (!schedule) {
      throw new NotFoundError('Lịch không tồn tại');
    }

    const allowed = ['startTime', 'endTime', 'status'];
    allowed.forEach((k) => {
      if (updateData[k] !== undefined) schedule[k] = updateData[k];
    });

    // Validate date formats if time is updated
    if (updateData.startTime) {
      const s = new Date(schedule.startTime);
      if (isNaN(s.getTime())) {
        throw new ValidationError('Thời gian bắt đầu không hợp lệ');
      }
    }
    if (updateData.endTime) {
      const e = new Date(schedule.endTime);
      if (isNaN(e.getTime())) {
        throw new ValidationError('Thời gian kết thúc không hợp lệ');
      }
    }

    // Validate time range
    if (schedule.endTime <= schedule.startTime) {
      throw new ValidationError('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
    }

    // Validate minimum duration if times are updated
    if (updateData.startTime || updateData.endTime) {
      const MIN_DURATION_MS = 60 * 60 * 1000; // 1 hour
      const duration = schedule.endTime.getTime() - schedule.startTime.getTime();
      if (duration < MIN_DURATION_MS) {
        throw new ValidationError('Thời gian thuê tối thiểu là 1 giờ');
      }
    }

    // Validate status if provided
    if (updateData.status && !Object.values(SCHEDULE_STATUS).includes(updateData.status)) {
      throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${Object.values(SCHEDULE_STATUS).join(', ')}`);
    }

    // Enforce minimum gap when updating
    const MIN_GAP_MS = 30 * 60 * 1000;
    const conflictQuery = Schedule.findOne({
      _id: { $ne: schedule._id },
      studioId: schedule.studioId,
      startTime: { $lt: new Date(schedule.endTime.getTime() + MIN_GAP_MS) },
      endTime: { $gt: new Date(schedule.startTime.getTime() - MIN_GAP_MS) },
    });
    if (session) conflictQuery.session(session);
    const conflict = await conflictQuery;

    if (conflict) {
      throw new ConflictError('Lịch cập nhật bị trùng hoặc quá gần với lịch đã có (khoảng cách tối thiểu 30 phút)');
    }

    await schedule.save({ session });
    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật lịch');
  }
};

export const deleteSchedule = async (id) => {
  try {
    if (!id) {
      throw new ValidationError('ID lịch là bắt buộc');
    }

    // Check if schedule exists and get its details first
    const schedule = await Schedule.findById(id);
    if (!schedule) {
      throw new NotFoundError('Lịch không tồn tại');
    }

    // Prevent deletion if schedule is booked
    if (schedule.status === SCHEDULE_STATUS.BOOKED) {
      throw new ConflictError('Không thể xóa lịch đã được đặt');
    }

    // Delete the schedule
    await Schedule.findByIdAndDelete(id);
    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa lịch');
  }
};

export const markScheduleBooked = async (scheduleId, bookingId, session = null) => {
  try {
    if (!scheduleId) {
      throw new ValidationError('ID lịch là bắt buộc');
    }
    if (!bookingId) {
      throw new ValidationError('ID booking là bắt buộc');
    }

    const query = Schedule.findById(scheduleId);
    if (session) query.session(session);
    const schedule = await query;
    
    if (!schedule) {
      throw new NotFoundError('Lịch không tồn tại');
    }
    
    if (schedule.status !== SCHEDULE_STATUS.AVAILABLE) {
      throw new ConflictError('Lịch không còn trống');
    }
    
    schedule.status = SCHEDULE_STATUS.BOOKED;
    schedule.bookingId = bookingId;
    await schedule.save({ session });
    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    throw new Error('Lỗi khi đánh dấu lịch đã đặt');
  }
};

export const freeSchedule = async (scheduleId, session = null) => {
  try {
    if (!scheduleId) {
      throw new ValidationError('ID lịch là bắt buộc');
    }

    const query = Schedule.findById(scheduleId);
    if (session) query.session(session);
    const schedule = await query;
    
    if (!schedule) {
      throw new NotFoundError('Lịch không tồn tại');
    }
    
    schedule.status = SCHEDULE_STATUS.AVAILABLE;
    schedule.bookingId = null;
    await schedule.save({ session });
    return schedule;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi giải phóng lịch');
  }
};

export default {
  createSchedule,
  getScheduleById,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  markScheduleBooked,
  freeSchedule,
};
