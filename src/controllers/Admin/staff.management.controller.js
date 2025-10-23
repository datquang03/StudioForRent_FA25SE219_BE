import asyncHandler from "express-async-handler";
import * as accountService from "../../services/account.service.js";
import { AUTH_MESSAGES } from "../../utils/constants.js";
import { createResponse } from "../../utils/helpers.js";

/**
 * ============================================
 * STAFF MANAGEMENT CONTROLLER
 * Admin quản lý staff và admin accounts
 * ============================================
 */

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const getErrorMessage = (errorCode) => {
  const errorMessages = {
    ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản!",
    EMAIL_ALREADY_EXISTS: AUTH_MESSAGES.EMAIL_EXISTS,
  };
  return errorMessages[errorCode] || "Có lỗi xảy ra!";
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * @desc    Admin xem danh sách tất cả staff
 * @route   GET /api/admin/staff
 * @access  Private (Admin only)
 */
export const getAllStaff = asyncHandler(async (req, res) => {
  try {
    const { page, limit, role, isActive } = req.query;

    const result = await accountService.getAllStaff({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    res.status(200).json(
      createResponse(true, "Lấy danh sách staff thành công!", result)
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin xem chi tiết 1 staff
 * @route   GET /api/admin/staff/:id
 * @access  Private (Admin only)
 */
export const getStaffById = asyncHandler(async (req, res) => {
  try {
    const account = await accountService.getStaffById(req.params.id);

    res.status(200).json(
      createResponse(true, "Lấy thông tin staff thành công!", {
        account,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin tạo staff mới
 * @route   POST /api/admin/staff
 * @access  Private (Admin only)
 */
export const createStaff = asyncHandler(async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    const staff = await accountService.createStaff({
      email,
      password,
      fullName,
      phone,
    });

    res.status(201).json(
      createResponse(true, "Tạo staff thành công!", {
        account: {
          id: staff._id,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
          isActive: staff.isActive,
        },
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin cập nhật thông tin staff
 * @route   PATCH /api/admin/staff/:id
 * @access  Private (Admin only)
 */
export const updateStaff = asyncHandler(async (req, res) => {
  try {
    const { fullName, phone, avatarUrl } = req.body;

    const account = await accountService.updateStaff(req.params.id, {
      fullName,
      phone,
      avatarUrl,
    });

    res.status(200).json(
      createResponse(true, "Cập nhật staff thành công!", {
        account,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin active staff
 * @route   PATCH /api/admin/staff/:id/activate
 * @access  Private (Admin only)
 */
export const activateStaff = asyncHandler(async (req, res) => {
  try {
    const account = await accountService.toggleActiveStaff(req.params.id, true);

    res.status(200).json(
      createResponse(true, "Active staff thành công!", {
        account,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin deactivate staff
 * @route   PATCH /api/admin/staff/:id/deactivate
 * @access  Private (Admin only)
 */
export const deactivateStaff = asyncHandler(async (req, res) => {
  try {
    const account = await accountService.toggleActiveStaff(req.params.id, false);

    res.status(200).json(
      createResponse(true, "Deactivate staff thành công!", {
        account,
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});
