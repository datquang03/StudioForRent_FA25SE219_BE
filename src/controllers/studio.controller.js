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
} from '../services/studio.service.js';
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
  const { name, description, basePricePerHour, capacity, images } = req.body;

  if (!name || basePricePerHour === undefined) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const studio = await createStudio({
    name,
    description,
    basePricePerHour,
    capacity,
    images,
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
  const { name, description, basePricePerHour, capacity, images } = req.body;

  const studio = await updateStudio(req.params.id, {
    name,
    description,
    basePricePerHour,
    capacity,
    images,
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
