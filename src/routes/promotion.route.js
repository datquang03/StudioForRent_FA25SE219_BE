//#region Imports
import express from "express";
import { protect, authorize } from "../middlewares/auth.js";
import { sanitizeInput } from "../middlewares/validate.js";
import { generalLimiter } from "../middlewares/rateLimiter.js";
import {
  validatePromotionCreation,
  validatePromotionUpdate,
  validatePromotionCode,
  validateObjectId,
} from "../middlewares/validate.js";
import {
  getPromotionList,
  getActivePromotionList,
  getPromotionDetail,
  createPromotionController,
  updatePromotionController,
  deletePromotionController,
  applyPromotionController,
  getPromotionUsageStats,
} from "../controllers/promotion.controller.js";
import { USER_ROLES } from "../utils/constants.js";
//#endregion

const router = express.Router();

//#region Public Routes
/**
 * GET /api/promotions/active
 * Lấy danh sách promotions đang hoạt động (Public)
 */
router.get("/active", generalLimiter, getActivePromotionList);
//#endregion

//#region Protected Routes - Customer
/**
 * POST /api/promotions/apply
 * Validate và áp dụng promotion code (Customer)
 */
router.post(
  "/apply",
  sanitizeInput,
  generalLimiter,
  protect,
  applyPromotionController
);
//#endregion

//#region Protected Routes - Admin Only
/**
 * GET /api/promotions
 * Lấy danh sách tất cả promotions (Admin)
 */
router.get(
  "/",
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  getPromotionList
);

/**
 * POST /api/promotions
 * Tạo promotion mới (Admin)
 */
router.post(
  "/",
  sanitizeInput,
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  validatePromotionCreation,
  createPromotionController
);

/**
 * GET /api/promotions/:id
 * Lấy chi tiết promotion (Admin)
 */
router.get(
  "/:id",
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  validateObjectId("id"),
  getPromotionDetail
);

/**
 * GET /api/promotions/:id/stats
 * Lấy thống kê sử dụng promotion (Admin)
 */
router.get(
  "/:id/stats",
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  validateObjectId("id"),
  getPromotionUsageStats
);

/**
 * PUT /api/promotions/:id
 * Cập nhật promotion (Admin)
 */
router.put(
  "/:id",
  sanitizeInput,
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  validateObjectId("id"),
  validatePromotionUpdate,
  updatePromotionController
);

/**
 * DELETE /api/promotions/:id
 * Xóa promotion (Admin)
 */
router.delete(
  "/:id",
  generalLimiter,
  protect,
  authorize(USER_ROLES.ADMIN),
  validateObjectId("id"),
  deletePromotionController
);
//#endregion

export default router;
