// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getAllEquipment,
  getEquipmentById,
  getAvailableEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  setMaintenanceQuantity,
} from '../services/equipment.service.js';
import { VALIDATION_MESSAGES } from '../utils/constants.js';
// #endregion

// #region Get Equipment
/**
 * Lấy danh sách equipment (cho staff/admin)
 */
export const getEquipmentList = asyncHandler(async (req, res) => {
  const { page, limit, status, search, sortBy, sortOrder } = req.query;

  const result = await getAllEquipment({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
    search,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách equipment thành công!',
    data: result,
  });
});

/**
 * Lấy danh sách equipment available (cho customer khi booking)
 */
export const getAvailableEquipmentList = asyncHandler(async (req, res) => {
  const equipment = await getAvailableEquipment();

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách equipment khả dụng thành công!',
    data: equipment,
  });
});

/**
 * Lấy chi tiết equipment theo ID
 */
export const getEquipmentDetail = asyncHandler(async (req, res) => {
  const equipment = await getEquipmentById(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin equipment thành công!',
    data: equipment,
  });
});
// #endregion

// #region Create Equipment
/**
 * Tạo equipment mới (staff/admin)
 */
export const createEquipmentController = asyncHandler(async (req, res) => {
  const { name, description, pricePerHour, totalQty, image } = req.body;

  // Validation already handled by validateEquipmentCreation middleware
  const equipment = await createEquipment({
    name,
    description,
    pricePerHour,
    totalQty,
    image,
  });

  res.status(201).json({
    success: true,
    message: 'Tạo equipment thành công!',
    data: equipment,
  });
});
// #endregion

// #region Update Equipment
/**
 * Cập nhật thông tin equipment (staff/admin)
 */
export const updateEquipmentController = asyncHandler(async (req, res) => {
  const { name, description, pricePerHour, totalQty, image } = req.body;

  const equipment = await updateEquipment(req.params.id, {
    name,
    description,
    pricePerHour,
    totalQty,
    image,
  });

  res.status(200).json({
    success: true,
    message: 'Cập nhật equipment thành công!',
    data: equipment,
  });
});
// #endregion

// #region Delete Equipment
/**
 * Xóa equipment (staff/admin)
 */
export const deleteEquipmentController = asyncHandler(async (req, res) => {
  const result = await deleteEquipment(req.params.id);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
// #endregion

// #region Set Maintenance Quantity
/**
 * Set số lượng equipment đang bảo trì (staff/admin)
 */
export const setMaintenanceQuantityController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  const equipment = await setMaintenanceQuantity(id, quantity);

  res.status(200).json({
    success: true,
    message: 'Cập nhật số lượng maintenance thành công!',
    data: equipment,
  });
});
// #endregion
