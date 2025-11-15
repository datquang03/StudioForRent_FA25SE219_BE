// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getAllCustomers,
  getCustomerById,
  toggleCustomerActive,
  getAllStaff,
  getStaffById,
  toggleStaffActive,
} from '../services/user.service.js';
// #endregion

// #region Customer Management
export const getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, isActive, search } = req.query;

  const result = await getAllCustomers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    search,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách customers thành công!',
    data: result,
  });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const user = await getCustomerById(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin customer thành công!',
    data: user,
  });
});

export const banCustomer = asyncHandler(async (req, res) => {
  const user = await toggleCustomerActive(req.params.id, false);

  res.status(200).json({
    success: true,
    message: 'Ban customer thành công!',
    data: user,
  });
});

export const unbanCustomer = asyncHandler(async (req, res) => {
  const user = await toggleCustomerActive(req.params.id, true);

  res.status(200).json({
    success: true,
    message: 'Unban customer thành công!',
    data: user,
  });
});
// #endregion

// #region Staff Management
export const getStaffList = asyncHandler(async (req, res) => {
  const { page, limit, position, isActive } = req.query;

  const result = await getAllStaff({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    position,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách staff thành công!',
    data: result,
  });
});

export const getStaff = asyncHandler(async (req, res) => {
  const user = await getStaffById(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin staff thành công!',
    data: user,
  });
});

export const deactivateStaff = asyncHandler(async (req, res) => {
  const user = await toggleStaffActive(req.params.id, false);

  res.status(200).json({
    success: true,
    message: 'Vô hiệu hóa staff thành công!',
    data: user,
  });
});

export const activateStaff = asyncHandler(async (req, res) => {
  const user = await toggleStaffActive(req.params.id, true);

  res.status(200).json({
    success: true,
    message: 'Kích hoạt staff thành công!',
    data: user,
  });
});
// #endregion
