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
  getActivePromotionDetailController,
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
router.get("/active/:id", generalLimiter, validateObjectId("id"), getActivePromotionDetailController);
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

//#region Protected Routes - Staff Only
/**
 * GET /api/promotions
 * Lấy danh sách tất cả promotions (Staff)
 */
router.get(
  "/",
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  getPromotionList
);

/**
 * POST /api/promotions
 * Tạo promotion mới (Staff)
 */
router.post(
  "/",
  sanitizeInput,
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  validatePromotionCreation,
  createPromotionController
);

/**
 * GET /api/promotions/:id
 * Lấy chi tiết promotion (Staff)
 */
router.get(
  "/:id",
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  validateObjectId("id"),
  getPromotionDetail
);

/**
 * GET /api/promotions/:id/stats
 * Lấy thống kê sử dụng promotion (Staff)
 */
router.get(
  "/:id/stats",
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  validateObjectId("id"),
  getPromotionUsageStats
);

/**
 * PUT /api/promotions/:id
 * Cập nhật promotion (Staff)
 */
router.put(
  "/:id",
  sanitizeInput,
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  validateObjectId("id"),
  validatePromotionUpdate,
  updatePromotionController
);

/**
 * DELETE /api/promotions/:id
 * Xóa promotion (Staff)
 */
router.delete(
  "/:id",
  generalLimiter,
  protect,
  authorize(USER_ROLES.STAFF),
  validateObjectId("id"),
  deletePromotionController
);
//#endregion

export default router;
