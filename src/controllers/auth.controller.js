// #region Imports
import asyncHandler from 'express-async-handler';
import {
  registerCustomer,
  verifyEmail,
  resendVerificationCode,
  login,
  loginWithGoogle,
  refreshAccessToken,
  logout,
  createStaffAccount,
  changePassword,
  forgotPassword,
} from '../services/auth.service.js';
import { AUTH_MESSAGES, VALIDATION_MESSAGES } from '../utils/constants.js';
import { ValidationError } from '../utils/errors.js';
// #endregion

// #region Customer Registration & Verification
export const registerCustomerController = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, phone } = req.body;

  if (!username || !email || !password || !fullName) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const user = await registerCustomer({ username, email, password, fullName, phone });

  res.status(201).json({
    success: true,
    message: AUTH_MESSAGES.REGISTER_SUCCESS,
    data: user,
  });
});

export const verifyEmailController = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const { user, accessToken, refreshToken } = await verifyEmail(email, code);

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.VERIFY_SUCCESS,
    data: { user, accessToken, refreshToken },
  });
});

export const resendCodeController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.REQUIRED_EMAIL);
  }

  await resendVerificationCode(email);

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.RESEND_CODE_SUCCESS,
  });
});
// #endregion

// #region Login & Authentication
export const loginController = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const { user, accessToken, refreshToken } = await login({ username, password }, ipAddress);

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.LOGIN_SUCCESS,
    data: { user, accessToken, refreshToken },
  });
});

export const googleLoginController = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400);
    throw new Error('idToken is required');
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const { user, accessToken, refreshToken } = await loginWithGoogle(idToken, ipAddress);

  res.status(200).json({
    success: true,
    message: 'Login with Google successful',
    data: { user, accessToken, refreshToken },
  });
});

export const refreshTokenController = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400);
    throw new ValidationError('Refresh token is required!');
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const tokens = await refreshAccessToken(refreshToken, ipAddress);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully!',
    data: tokens,
  });
});

export const logoutController = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400);
    throw new ValidationError('Refresh token is required!');
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  await logout(refreshToken, ipAddress);

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.LOGOUT_SUCCESS,
  });
});

export const getMeController = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});
// #endregion

// #region Staff Account Creation (Admin Only)
export const createStaffController = asyncHandler(async (req, res) => {
  const { username, email, fullName, phone } = req.body; // Không cần position

  if (!username || !email || !fullName) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const staff = await createStaffAccount({
    username,
    email,
    fullName,
    phone,
    position: 'staff', // Luôn là staff
  });

  res.status(201).json({
    success: true,
    message: 'Tạo tài khoản nhân viên thành công! Email đã được gửi.',
    data: {
      user: {
        _id: staff._id,
        username: staff.username,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
      },
      generatedPassword: staff.generatedPassword, // Trả về để admin có thể thông báo thủ công nếu cần
    },
  });
});

// Change Password
export const changePasswordController = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user._id; // Từ middleware protect

  if (!oldPassword || !newPassword) {
    res.status(400);
    throw new ValidationError('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới!');
  }

  // Validate new password
  if (newPassword.length < 8) {
    res.status(400);
    throw new ValidationError('Mật khẩu mới phải có ít nhất 8 ký tự!');
  }

  const result = await changePassword(userId, oldPassword, newPassword);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
// #endregion

// Forgot password - generate new password and send to email
export const forgotPasswordController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new ValidationError('Vui lòng cung cấp email!');
  }

  const result = await forgotPassword(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
