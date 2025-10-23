import asyncHandler from "express-async-handler";
import * as customerService from "../../services/customer.service.js";
import { AUTH_MESSAGES } from "../../utils/constants.js";
import { createResponse, toUserResponse } from "../../utils/helpers.js";

/**
 * ============================================
 * CUSTOMER MANAGEMENT CONTROLLER
 * Admin quản lý customers
 * ============================================
 */

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const getErrorMessage = (errorCode) => {
  const errorMessages = {
    USER_NOT_FOUND: AUTH_MESSAGES.USER_NOT_FOUND,
  };
  return errorMessages[errorCode] || "Có lỗi xảy ra!";
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * @desc    Admin xem danh sách tất cả customers
 * @route   GET /api/admin/customers
 * @access  Private (Admin only)
 */
export const getAllCustomers = asyncHandler(async (req, res) => {
  try {
    const { page, limit, isBanned, search } = req.query;

    const result = await customerService.getAllCustomers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      isBanned: isBanned === 'true' ? true : isBanned === 'false' ? false : undefined,
      search,
    });

    res.status(200).json(
      createResponse(true, "Lấy danh sách customers thành công!", result)
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin xem chi tiết 1 customer
 * @route   GET /api/admin/customers/:id
 * @access  Private (Admin only)
 */
export const getCustomerById = asyncHandler(async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);

    res.status(200).json(
      createResponse(true, "Lấy thông tin customer thành công!", {
        customer: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin ban customer
 * @route   PATCH /api/admin/customers/:id/ban
 * @access  Private (Admin only)
 */
export const banCustomer = asyncHandler(async (req, res) => {
  try {
    const customer = await customerService.toggleBanCustomer(req.params.id, true);

    res.status(200).json(
      createResponse(true, "Ban customer thành công!", {
        customer: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin unban customer
 * @route   PATCH /api/admin/customers/:id/unban
 * @access  Private (Admin only)
 */
export const unbanCustomer = asyncHandler(async (req, res) => {
  try {
    const customer = await customerService.toggleBanCustomer(req.params.id, false);

    res.status(200).json(
      createResponse(true, "Unban customer thành công!", {
        customer: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});

/**
 * @desc    Admin cập nhật thông tin customer
 * @route   PATCH /api/admin/customers/:id
 * @access  Private (Admin only)
 */
export const updateCustomer = asyncHandler(async (req, res) => {
  try {
    const { fullName, phone, avatarUrl } = req.body;

    const customer = await customerService.updateCustomerProfile(req.params.id, {
      fullName,
      phone,
      avatarUrl,
    });

    res.status(200).json(
      createResponse(true, "Cập nhật customer thành công!", {
        customer: toUserResponse(customer),
      })
    );
  } catch (error) {
    const message = getErrorMessage(error.message);
    res.status(400).json(createResponse(false, message));
  }
});
