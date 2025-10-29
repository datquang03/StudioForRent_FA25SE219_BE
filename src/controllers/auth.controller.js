import asyncHandler from 'express-async-handler';
import {
  registerCustomer,
  verifyEmail,
  resendVerificationCode,
  login,
  createStaffAccount,
} from '../services/auth.service.js';
import { AUTH_MESSAGES, VALIDATION_MESSAGES } from '../utils/constants.js';

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

  const { user, token } = await verifyEmail(email, code);

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.VERIFY_SUCCESS,
    data: { user, token },
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

export const loginController = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const { user, token } = await login({ username, password });

  res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.LOGIN_SUCCESS,
    data: { user, token },
  });
});

export const createStaffController = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, phone, position, salary } = req.body;

  if (!username || !email || !password || !fullName || !position) {
    res.status(400);
    throw new Error(VALIDATION_MESSAGES.MISSING_FIELDS);
  }

  const staff = await createStaffAccount({
    username,
    email,
    password,
    fullName,
    phone,
    position,
    salary,
  });

  res.status(201).json({
    success: true,
    message: 'Tạo tài khoản nhân viên thành công!',
    data: staff,
  });
});

export const getMeController = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});
