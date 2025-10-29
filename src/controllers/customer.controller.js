import asyncHandler from 'express-async-handler';
import {
  getCustomerProfile,
  updateCustomerProfile,
  toggleCustomerActive,
} from '../services/user.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await getCustomerProfile(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin profile thành công!',
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, avatar, address, dateOfBirth, preferences } = req.body;

  const user = await updateCustomerProfile(req.user._id, {
    fullName,
    phone,
    avatar,
    address,
    dateOfBirth,
    preferences,
  });

  res.status(200).json({
    success: true,
    message: 'Cập nhật profile thành công!',
    data: user,
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await toggleCustomerActive(req.user._id, false);

  res.status(200).json({
    success: true,
    message: 'Xóa tài khoản thành công!',
  });
});
