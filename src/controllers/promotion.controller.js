//#region Imports
import asyncHandler from "express-async-handler";
import { createResponse } from "../utils/helpers.js";
import * as promotionService from "../services/promotion.service.js";
//#endregion

//#region Get Promotion List (Admin)
/**
 * GET /api/promotions
 * Lấy danh sách promotions với pagination (Admin)
 */
export const getPromotionList = asyncHandler(async (req, res) => {
  const result = await promotionService.getAllPromotions(req.query);

  res.status(200).json(
    createResponse(true, "Lấy danh sách khuyến mãi thành công!", result)
  );
});
//#endregion

//#region Get Active Promotion List (Public)
/**
 * GET /api/promotions/active
 * Lấy danh sách promotions đang hoạt động (Public)
 */
export const getActivePromotionList = asyncHandler(async (req, res) => {
  const promotions = await promotionService.getActivePromotions();

  res.status(200).json(
    createResponse(true, "Lấy danh sách khuyến mãi thành công!", {
      promotions,
      total: promotions.length,
    })
  );
});
//#endregion

//#region Get Promotion Detail
/**
 * GET /api/promotions/:id
 * Lấy chi tiết promotion
 */
export const getPromotionDetail = asyncHandler(async (req, res) => {
  const promotion = await promotionService.getPromotionById(req.params.id);

  res.status(200).json(
    createResponse(true, "Lấy thông tin khuyến mãi thành công!", { promotion })
  );
});
//#endregion

//#region Active Promotion Details (Public)
/**
 * GET /api/promotions/active/:id
 * Lấy chi tiết promotion đang hoạt động (Public)
 */
export const getActivePromotionDetailController = asyncHandler(async (req, res) => {
  const promotion = await promotionService.getActivePromotionDetail(req.params.id);

  res.status(200).json(
    createResponse(true, "Lấy thông tin khuyến mãi thành công!", { promotion })
  );
});
//#endregion

//#region Create Promotion (Admin)
/**
 * POST /api/promotions
 * Tạo promotion mới (Admin only)
 */
export const createPromotionController = asyncHandler(async (req, res) => {
  const promotion = await promotionService.createPromotion(req.body);

  res.status(201).json(
    createResponse(true, "Tạo khuyến mãi thành công!", { promotion })
  );
});
//#endregion

//#region Update Promotion (Admin)
/**
 * PUT /api/promotions/:id
 * Cập nhật promotion (Admin only)
 */
export const updatePromotionController = asyncHandler(async (req, res) => {
  const promotion = await promotionService.updatePromotion(
    req.params.id,
    req.body
  );

  res.status(200).json(
    createResponse(true, "Cập nhật khuyến mãi thành công!", { promotion })
  );
});
//#endregion

//#region Delete Promotion (Admin)
/**
 * DELETE /api/promotions/:id
 * Xóa promotion (Admin only)
 */
export const deletePromotionController = asyncHandler(async (req, res) => {
  const result = await promotionService.deletePromotion(req.params.id);

  res.status(200).json(createResponse(true, result.message));
});
//#endregion

//#region Apply Promotion Code
/**
 * POST /api/promotions/apply
 * Validate và tính discount cho promotion code
 * Body: { code, subtotal }
 */
export const applyPromotionController = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;

  // Validate input
  if (!code || !code.trim()) {
    return res.status(400).json(
      createResponse(false, "Mã khuyến mãi là bắt buộc!")
    );
  }

  if (!subtotal || typeof subtotal !== "number" || subtotal <= 0) {
    return res.status(400).json(
      createResponse(false, "Giá trị đơn hàng không hợp lệ!")
    );
  }

  // Apply promotion
  const result = await promotionService.validateAndApplyPromotion(
    code,
    req.user._id, // Customer ID from JWT
    subtotal
  );

  res.status(200).json(
    createResponse(true, "Áp dụng mã khuyến mãi thành công!", result)
  );
});
//#endregion

//#region Get Promotion Usage Stats (Admin - Optional)
/**
 * GET /api/promotions/:id/stats
 * Lấy thống kê sử dụng của promotion (Admin)
 */
export const getPromotionUsageStats = asyncHandler(async (req, res) => {
  const promotion = await promotionService.getPromotionById(req.params.id);

  const stats = {
    code: promotion.code,
    name: promotion.name,
    usageCount: promotion.usageCount,
    usageLimit: promotion.usageLimit,
    usagePercentage: promotion.usageLimit 
      ? ((promotion.usageCount / promotion.usageLimit) * 100).toFixed(2) + '%'
      : 'Unlimited',
    remainingSlots: promotion.usageLimit 
      ? Math.max(0, promotion.usageLimit - promotion.usageCount)
      : 'Unlimited',
    isActive: promotion.isActive,
    isValid: promotion.isValid ? promotion.isValid() : false,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
  };

  res.status(200).json(
    createResponse(true, "Lấy thống kê thành công!", { stats })
  );
});
//#endregion
