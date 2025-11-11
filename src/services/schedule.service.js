// #region Imports
import { Schedule } from '../models/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { SCHEDULE_STATUS } from '../utils/constants.js';
// #endregion

export const createSchedule = async (data) => {
  const { studioId, startTime, endTime } = data;

  if (!studioId || !startTime || !endTime) {
    throw new ValidationError('Missing required fields for schedule');
  }

  const s = new Date(startTime);
  const e = new Date(endTime);
  if (!(e > s)) {
    throw new ValidationError('endTime must be greater than startTime');
  }

  // Minimum gap between schedules (30 minutes)
  const MIN_GAP_MS = 30 * 60 * 1000; // 30 minutes in ms

  // Prevent overlapping schedules and enforce minimum gap for the same studio
  // Conflict if existing.start < (e + buffer) && existing.end > (s - buffer)
  const conflict = await Schedule.findOne({
    studioId,
    startTime: { $lt: new Date(e.getTime() + MIN_GAP_MS) },
    endTime: { $gt: new Date(s.getTime() - MIN_GAP_MS) },
  });

  if (conflict) {
    throw new ConflictError('Schedule overlaps or is too close to an existing slot (minimum gap 30 minutes)');
  }

  const schedule = await Schedule.create({
    studioId,
    startTime: s,
    endTime: e,
    status: data.status || SCHEDULE_STATUS.AVAILABLE,
  });

  return schedule;
};

export const getScheduleById = async (id) => {
  const schedule = await Schedule.findById(id).lean();
  if (!schedule) throw new NotFoundError('Schedule not found');
  return schedule;
};

export const getSchedules = async ({ studioId, status, page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 200);
  const query = {};
  if (studioId) query.studioId = studioId;
  if (status) query.status = status;

  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    Schedule.find(query).sort({ startTime: 1 }).skip(skip).limit(safeLimit).lean(),
    Schedule.countDocuments(query),
  ]);

  return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) };
};

export const updateSchedule = async (id, updateData) => {
  const schedule = await Schedule.findById(id);
  if (!schedule) throw new NotFoundError('Schedule not found');

  const allowed = ['startTime', 'endTime', 'status'];
  allowed.forEach((k) => {
    if (updateData[k] !== undefined) schedule[k] = updateData[k];
  });

  if (schedule.endTime <= schedule.startTime) {
    throw new ValidationError('endTime must be greater than startTime');
  }

  // Enforce minimum gap when updating
  const MIN_GAP_MS = 30 * 60 * 1000;
  const conflict = await Schedule.findOne({
    _id: { $ne: schedule._id },
    studioId: schedule.studioId,
    startTime: { $lt: new Date(schedule.endTime.getTime() + MIN_GAP_MS) },
    endTime: { $gt: new Date(schedule.startTime.getTime() - MIN_GAP_MS) },
  });

  if (conflict) {
    throw new ConflictError('Updated schedule would overlap or be too close to an existing slot (minimum gap 30 minutes)');
  }

  await schedule.save();
  return schedule;
};

export const deleteSchedule = async (id) => {
  const schedule = await Schedule.findByIdAndDelete(id);
  if (!schedule) throw new NotFoundError('Schedule not found');
  return schedule;
};

export const markScheduleBooked = async (scheduleId, bookingId) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError('Schedule not found');
  if (schedule.status !== SCHEDULE_STATUS.AVAILABLE) {
    throw new ConflictError('Schedule is not available');
  }
  schedule.status = SCHEDULE_STATUS.BOOKED;
  schedule.bookingId = bookingId;
  await schedule.save();
  return schedule;
};

export const freeSchedule = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError('Schedule not found');
  schedule.status = SCHEDULE_STATUS.AVAILABLE;
  schedule.bookingId = null;
  await schedule.save();
  return schedule;
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
