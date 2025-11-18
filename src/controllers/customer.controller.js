// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getCustomerProfile,
  updateCustomerProfile,
  toggleCustomerActive,
} from '../services/user.service.js';
import { uploadImage } from '../services/upload.service.js';
import User from '../models/User/user.model.js';
// #endregion

// #region Customer Profile Management
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

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Không có file avatar được cung cấp!',
    });
  }

  const userId = req.user._id;
  const folder = `studio-rental/users/${userId}/avatar`;

  // Upload avatar to Cloudinary
  const result = await uploadImage(req.file, {
    folder,
    public_id: `avatar_${Date.now()}`
  });

  // Update user avatar in database
  await User.findByIdAndUpdate(userId, {
    avatar: result.url
  });

  res.status(200).json({
    success: true,
    message: 'Upload avatar thành công!',
    data: {
      avatar: result.url
    }
  });
});
// #endregion
