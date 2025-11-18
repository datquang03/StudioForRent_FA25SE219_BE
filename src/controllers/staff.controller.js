import asyncHandler from 'express-async-handler';
import { getStaffById, updateStaffProfile } from '../services/user.service.js';
import { uploadImage } from '../services/upload.service.js';
import User from '../models/User/user.model.js';

// Get staff profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await getStaffById(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin profile thành công!',
    data: user,
  });
});

// Update staff profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, address, dateOfBirth, preferences } = req.body;

  const user = await updateStaffProfile(req.user._id, {
    fullName,
    phone,
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

// Upload staff avatar
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No avatar file provided'
    });
  }

  const userId = req.user._id;
  const result = await uploadImage(req.file, {
    folder: `studio-rental/users/${userId}/avatar`,
    public_id: `avatar_${Date.now()}`
  });

  await User.findByIdAndUpdate(userId, { avatar: result.url });

  res.status(200).json({
    success: true,
    message: 'Avatar updated successfully',
    data: { avatar: result }
  });
});