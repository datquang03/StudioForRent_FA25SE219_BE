import asyncHandler from "express-async-handler";
import authService from "../../services/auth.service.js";
import { generateToken } from "../../middlewares/auth.js";
import { AUTH_MESSAGES } from "../../utils/constants.js";
import { createResponse, toUserResponse } from "../../utils/helpers.js";

/**
 * ============================================
 * CUSTOMER AUTHENTICATION CONTROLLER
 * Xử lý authentication cho Customer (register, login, verify email)
 * ============================================
 */

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const getErrorMessage = (errorCode) => {
  const errorMessages = {
    EMAIL_EXISTS: AUTH_MESSAGES.EMAIL_EXISTS,
    USERNAME_EXISTS: AUTH_MESSAGES.USERNAME_EXISTS,
    USER_NOT_FOUND: AUTH_MESSAGES.USER_NOT_FOUND,
    ALREADY_VERIFIED: AUTH_MESSAGES.ALREADY_VERIFIED,
    CODE_EXPIRED: AUTH_MESSAGES.CODE_EXPIRED,
    CODE_NOT_FOUND: AUTH_MESSAGES.CODE_EXPIRED,
    INVALID_CODE: AUTH_MESSAGES.INVALID_CODE,
    INVALID_CREDENTIALS: AUTH_MESSAGES.INVALID_CREDENTIALS,
    NOT_VERIFIED: AUTH_MESSAGES.NOT_VERIFIED,
  };
  return errorMessages[errorCode] || "Có lỗi xảy ra!";
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * @desc    Đăng ký customer mới
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerCustomer = asyncHandler(async (req, res) => {
  const { username, email, password, phone, fullName } = req.body;

  try {
    const customer = await authService.register({
      username,
      email,
      password,
      phone,
      fullName,
    });

    res.status(201).json(
      createResponse(true, "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.", {
        user: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Xác thực email bằng mã 6 số
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  try {
    const customer = await authService.verifyEmail(email, code);

    res.status(200).json(
      createResponse(true, "Xác thực email thành công! Bạn có thể đăng nhập ngay.", {
        user: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Gửi lại mã xác thực
 * @route   POST /api/auth/resend-code
 * @access  Public
 */
export const resendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    await authService.resendVerificationCode(email);

    res.status(200).json(
      createResponse(true, "Đã gửi lại mã xác thực. Vui lòng kiểm tra email!")
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Đăng nhập customer
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginCustomer = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  try {
    const customer = await authService.login(username, password);

    // Generate JWT token
    const token = generateToken(customer._id, "customer");

    res.status(200).json(
      createResponse(true, "Đăng nhập thành công!", {
        user: toUserResponse(customer),
        token,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});
