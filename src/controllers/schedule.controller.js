// #region Imports
import asyncHandler from 'express-async-handler';
import {
  createSchedule as createScheduleService,
  getSchedules as getSchedulesService,
  getScheduleById as getScheduleByIdService,
  updateSchedule as updateScheduleService,
  deleteSchedule as deleteScheduleService,
} from '../services/schedule.service.js';
// #endregion

export const createSchedule = asyncHandler(async (req, res) => {
  const data = req.body;
  const schedule = await createScheduleService(data);

  res.status(201).json({
    success: true,
    message: 'Tạo lịch thành công!',
    data: schedule,
  });
});

export const getSchedules = asyncHandler(async (req, res) => {
  const { studioId, status, page, limit } = req.query;
  const result = await getSchedulesService({ studioId, status, page, limit });

  res.status(200).json({ success: true, message: 'Lấy danh sách lịch thành công!', data: result });
});

export const getSchedule = asyncHandler(async (req, res) => {
  const schedule = await getScheduleByIdService(req.params.id);
  res.status(200).json({ success: true, message: 'Lấy lịch thành công!', data: schedule });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await updateScheduleService(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Cập nhật lịch thành công!', data: schedule });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await deleteScheduleService(req.params.id);
  res.status(200).json({ success: true, message: 'Xóa lịch thành công!', data: schedule });
});

export default {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
};
