import express from "express";
import * as customerManagement from "../controllers/Admin/customer.management.controller.js";
import * as staffManagement from "../controllers/Admin/staff.management.controller.js";
import { protect, authorize } from "../middlewares/auth.js";
import { adminLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * ============================================
 * ADMIN ROUTES
 * Admin quản lý customers và staff
 * Rate limit: 50 requests / 15 phút
 * ============================================
 */

// Áp dụng rate limiting cho tất cả admin routes
router.use(adminLimiter);

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/customers
 * @desc    Admin xem danh sách customers (có phân trang, tìm kiếm, lọc)
 * @access  Private (Admin only)
 */
router.get("/customers", protect, authorize("admin"), customerManagement.getAllCustomers);

/**
 * @route   GET /api/admin/customers/:id
 * @desc    Admin xem chi tiết 1 customer
 * @access  Private (Admin only)
 */
router.get("/customers/:id", protect, authorize("admin"), customerManagement.getCustomerById);

/**
 * @route   PATCH /api/admin/customers/:id
 * @desc    Admin cập nhật thông tin customer
 * @access  Private (Admin only)
 */
router.patch("/customers/:id", protect, authorize("admin"), customerManagement.updateCustomer);

/**
 * @route   PATCH /api/admin/customers/:id/ban
 * @desc    Admin ban customer
 * @access  Private (Admin only)
 */
router.patch("/customers/:id/ban", protect, authorize("admin"), customerManagement.banCustomer);

/**
 * @route   PATCH /api/admin/customers/:id/unban
 * @desc    Admin unban customer
 * @access  Private (Admin only)
 */
router.patch("/customers/:id/unban", protect, authorize("admin"), customerManagement.unbanCustomer);

// ============================================
// STAFF MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/staff
 * @desc    Admin xem danh sách staff (có phân trang, lọc)
 * @access  Private (Admin only)
 */
router.get("/staff", protect, authorize("admin"), staffManagement.getAllStaff);

/**
 * @route   GET /api/admin/staff/:id
 * @desc    Admin xem chi tiết 1 staff
 * @access  Private (Admin only)
 */
router.get("/staff/:id", protect, authorize("admin"), staffManagement.getStaffById);

/**
 * @route   POST /api/admin/staff
 * @desc    Admin tạo staff mới
 * @access  Private (Admin only)
 */
router.post("/staff", protect, authorize("admin"), staffManagement.createStaff);

/**
 * @route   PATCH /api/admin/staff/:id
 * @desc    Admin cập nhật thông tin staff
 * @access  Private (Admin only)
 */
router.patch("/staff/:id", protect, authorize("admin"), staffManagement.updateStaff);

/**
 * @route   PATCH /api/admin/staff/:id/activate
 * @desc    Admin active staff
 * @access  Private (Admin only)
 */
router.patch("/staff/:id/activate", protect, authorize("admin"), staffManagement.activateStaff);

/**
 * @route   PATCH /api/admin/staff/:id/deactivate
 * @desc    Admin deactivate staff
 * @access  Private (Admin only)
 */
router.patch("/staff/:id/deactivate", protect, authorize("admin"), staffManagement.deactivateStaff);

export default router;
