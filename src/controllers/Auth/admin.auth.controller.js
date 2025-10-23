import asyncHandler from "express-async-handler";
import authService from "../../services/auth.service.js";
import { generateToken } from "../../middlewares/auth.js";
import { AUTH_MESSAGES } from "../../utils/constants.js";
import { createResponse, toUserResponse } from "../../utils/helpers.js";

/**
 * ============================================
 * ADMIN/STAFF AUTHENTICATION CONTROLLER
 * Xử lý authentication cho Admin và Staff
 * ============================================
 */

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const getErrorMessage = (errorCode) => {
  const errorMessages = {
    EMAIL_EXISTS: AUTH_MESSAGES.EMAIL_EXISTS,
    USER_NOT_FOUND: AUTH_MESSAGES.USER_NOT_FOUND,
    INVALID_CREDENTIALS: AUTH_MESSAGES.INVALID_CREDENTIALS,
    ACCOUNT_INACTIVE: AUTH_MESSAGES.ACCOUNT_INACTIVE,
    ACCOUNT_DEACTIVATED: "Tài khoản đã bị vô hiệu hóa!",
  };
  return errorMessages[errorCode] || "Có lỗi xảy ra!";
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * @desc    Tạo tài khoản admin đầu tiên (chỉ dùng 1 lần)
 * @route   POST /api/auth/setup-admin
 * @access  Public (nhưng cần secret key)
 */
export const setupAdmin = asyncHandler(async (req, res) => {
  const { email, password, fullName, secretKey } = req.body;

  // Kiểm tra secret key (bảo mật)
  if (secretKey !== process.env.ADMIN_SETUP_SECRET) {
    return res.status(403).json(
      createResponse(false, "Secret key không hợp lệ!")
    );
  }

  try {
    await authService.createAdmin({ email, password, fullName });

    res.status(201).json(
      createResponse(true, "Tạo tài khoản admin thành công!")
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Đăng nhập staff/admin
 * @route   POST /api/auth/admin-login
 * @access  Public
 */
export const loginStaffAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const account = await authService.loginAccount(email, password);

    // Generate JWT token với role (staff hoặc admin)
    const token = generateToken(account._id, account.role);

    res.status(200).json(
      createResponse(true, "Đăng nhập thành công!", {
        user: {
          id: account._id,
          email: account.email,
          fullName: account.fullName,
          role: account.role,
          isActive: account.isActive,
        },
        token,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});
