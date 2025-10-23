import asyncHandler from "express-async-handler";
import * as customerService from "../../services/customer.service.js";
import { AUTH_MESSAGES } from "../../utils/constants.js";
import { createResponse, toUserResponse } from "../../utils/helpers.js";

/**
 * ============================================
 * CUSTOMER CONTROLLER
 * Customer tự quản lý profile của mình
 * ============================================
 */

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const getErrorMessage = (errorCode) => {
  const errorMessages = {
    USER_NOT_FOUND: AUTH_MESSAGES.USER_NOT_FOUND,
    INVALID_OLD_PASSWORD: "Mật khẩu cũ không chính xác!",
  };
  return errorMessages[errorCode] || "Có lỗi xảy ra!";
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * @desc    Customer xem profile của chính mình
 * @route   GET /api/customers/profile
 * @access  Private (Customer only)
 */
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const customer = await customerService.getCustomerProfile(req.user.id);

    res.status(200).json(
      createResponse(true, "Lấy thông tin profile thành công!", {
        user: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Customer cập nhật profile của mình
 * @route   PATCH /api/customers/profile
 * @access  Private (Customer only)
 */
export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const { fullName, phone, avatarUrl, preferences } = req.body;

    const customer = await customerService.updateCustomerProfile(req.user.id, {
      fullName,
      phone,
      avatarUrl,
      preferences,
    });

    res.status(200).json(
      createResponse(true, "Cập nhật profile thành công!", {
        user: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Customer xóa tài khoản của mình (soft delete - đánh dấu isBanned)
 * @route   DELETE /api/customers/profile
 * @access  Private (Customer only)
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  try {
    await customerService.toggleBanCustomer(req.user.id, true);

    res.status(200).json(
      createResponse(true, "Xóa tài khoản thành công!")
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});
