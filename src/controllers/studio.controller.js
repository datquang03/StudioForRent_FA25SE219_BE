// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getAllStudios,
  getStudioById,
  createStudio,
  updateStudio,
  changeStudioStatus,
  deleteStudio,
  getActiveStudios,
  getStudioSchedule,
  getStudioScheduleByDate,
  getStudiosSchedule,
  getStudiosScheduleByDate,
  getStudiosAvailability,
  getStudioBookedHistory,
  getStudiosBookedSchedules,
} from '../services/studio.service.js';
import { uploadMultipleImages, uploadVideo } from '../services/upload.service.js';
import { VALIDATION_MESSAGES } from '../utils/constants.js';
// #endregion

// #region Get Studios
export const getStudios = asyncHandler(async (req, res) => {
  const { page, limit, status, search, sortBy, sortOrder } = req.query;

  const result = await getAllStudios({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
    search,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách studios thành công!',
    data: result,
  });
});

export const getActiveStudiosController = asyncHandler(async (req, res) => {
  const { page, limit, search, sortBy, sortOrder } = req.query;

  const result = await getActiveStudios({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    search,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách studios thành công!',
    data: result,
  });
});

export const getStudio = asyncHandler(async (req, res) => {
  const studio = await getStudioById(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin studio thành công!',
    data: studio,
  });
});
// #endregion

// #region Create Studio
export const createStudioController = asyncHandler(async (req, res) => {
  const { name, description, area, location, basePricePerHour, capacity, images, video } = req.body;

  if (!name || basePricePerHour === undefined) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const studio = await createStudio({
    name,
    description,
    area,
    location,
    basePricePerHour,
    capacity,
    images,
    video,
  });

  res.status(201).json({
    success: true,
    message: 'Tạo studio thành công!',
    data: studio,
  });
});
// #endregion

// #region Update Studio
export const updateStudioController = asyncHandler(async (req, res) => {
  const { name, description, area, location, basePricePerHour, capacity, images, video } = req.body;

  const studio = await updateStudio(req.params.id, {
    name,
    description,
    area,
    location,
    basePricePerHour,
    capacity,
    images,
    video,
  });

  res.status(200).json({
    success: true,
    message: 'Cập nhật studio thành công!',
    data: studio,
  });
});
// #endregion

// #region Change Studio Status
export const activateStudio = asyncHandler(async (req, res) => {
  const studio = await changeStudioStatus(req.params.id, 'active');

  res.status(200).json({
    success: true,
    message: 'Kích hoạt studio thành công!',
    data: studio,
  });
});

export const deactivateStudio = asyncHandler(async (req, res) => {
  const studio = await changeStudioStatus(req.params.id, 'inactive');

  res.status(200).json({
    success: true,
    message: 'Vô hiệu hóa studio thành công!',
    data: studio,
  });
});

export const setMaintenanceStudio = asyncHandler(async (req, res) => {
  const studio = await changeStudioStatus(req.params.id, 'maintenance');

  res.status(200).json({
    success: true,
    message: 'Chuyển studio sang trạng thái bảo trì!',
    data: studio,
  });
});
// #endregion

// #region Delete Studio
export const deleteStudioController = asyncHandler(async (req, res) => {
  const result = await deleteStudio(req.params.id);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
// #endregion

// #region Upload Studio Media
export const uploadStudioMedia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const uploadedMedia = {
    images: [],
    video: null
  };

  // Handle images
  if (req.files.images && req.files.images.length > 0) {
    const imageResults = await uploadMultipleImages(req.files.images, {
      folder: `studio-rental/studios/${id}`
    });
    uploadedMedia.images = imageResults;
  }

  // Handle video
  if (req.files.video && req.files.video.length > 0) {
    const videoResult = await uploadVideo(req.files.video[0], {
      folder: `studio-rental/studios/${id}/videos`
    });
    uploadedMedia.video = videoResult;
  }

  if (uploadedMedia.images.length === 0 && !uploadedMedia.video) {
    res.status(400);
    throw new Error('Không có file media nào được cung cấp!');
  }

  // Update studio with new media URLs
  const updateData = {};
  if (uploadedMedia.images.length > 0) {
    updateData.images = uploadedMedia.images.map(img => img.url);
  }
  if (uploadedMedia.video) {
    updateData.video = uploadedMedia.video.url;
  }

  const studio = await updateStudio(id, updateData);

  res.status(200).json({
    success: true,
    message: 'Upload media studio thành công!',
    data: {
      studio,
      uploadedMedia: {
        images: uploadedMedia.images.map(img => img.url),
        video: uploadedMedia.video ? uploadedMedia.video.url : null
      }
    }
  });
});
// #endregion

// #region Studio Availability

/**
 * Get schedule (booked/ongoing) for a specific studio
 * GET /api/studios/:id/schedule
 */
export const getStudioScheduleController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const result = await getStudioSchedule(id, {
    startDate,
    endDate
  });

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin lịch của studio thành công!',
    data: result,
  });
});

/**
 * Get schedule for a specific studio on a single date
 * GET /api/studios/:id/schedule/date/:date
 */
export const getStudioScheduleByDateController = asyncHandler(async (req, res) => {
  const { id, date } = req.params;

  if (!date) {
    res.status(400);
    throw new Error('Ngày là bắt buộc');
  }

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    res.status(400);
    throw new Error('Định dạng ngày không hợp lệ');
  }

  const result = await getStudioScheduleByDate(id, targetDate);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin lịch của studio theo ngày thành công!',
    data: result,
  });
});

/**
 * Get schedules for all studios by date range
 * GET /api/studios/schedule
 */
export const getStudiosScheduleController = asyncHandler(async (req, res) => {
  const { startDate, endDate, page, limit } = req.query;

  const result = await getStudiosSchedule({
    startDate,
    endDate,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10
  });

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin lịch của các studios thành công!',
    data: result,
  });
});

/**
 * Get schedules for all studios by a single date
 * GET /api/studios/schedule/date/:date
 */
export const getStudiosScheduleByDateController = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { page, limit } = req.query;

  if (!date) {
    res.status(400);
    throw new Error('Ngày là bắt buộc');
  }

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    res.status(400);
    throw new Error('Định dạng ngày không hợp lệ');
  }

  const result = await getStudiosScheduleByDate(
    targetDate,
    parseInt(page) || 1,
    parseInt(limit) || 10
  );

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin lịch của các studios theo ngày thành công!',
    data: result,
  });
});

/**
 * Get availability summary for multiple studios
 * GET /api/studios/availability
 */
export const getStudiosAvailabilityController = asyncHandler(async (req, res) => {
  const { startDate, endDate, page, limit } = req.query;

  const result = await getStudiosAvailability({
    startDate,
    endDate,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10
  });

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin availability của các studios thành công!',
    data: result,
  });
});

// #endregion

// #region Studio Booked Schedules

/**
 * Get booked history for a specific studio
 * GET /api/studios/:id/booked-history
 */
export const getStudioBookedHistoryController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const result = await getStudioBookedHistory(id, {
    startDate,
    endDate
  });

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin booked history của studio thành công!',
    data: result,
  });
});

/**
 * Get booked schedules summary for multiple studios
 * GET /api/studios/booked-schedules
 */
export const getStudiosBookedSchedulesController = asyncHandler(async (req, res) => {
  const { startDate, endDate, page, limit } = req.query;

  const result = await getStudiosBookedSchedules({
    startDate,
    endDate,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10
  });

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin booked schedules của các studios thành công!',
    data: result,
  });
});

// #endregion
