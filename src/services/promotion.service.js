//#region Imports
import Promotion from "../models/Promotion/promotion.model.js";
import Booking from "../models/Booking/booking.model.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { escapeRegex } from "../utils/helpers.js";
import { PROMOTION_APPLICABLE_FOR } from "../utils/constants.js";
//#endregion

//#region Get All Promotions (Admin)
/**
 * Lấy danh sách tất cả promotions với pagination và search
 * @param {Object} query - { page, limit, search, isActive, applicableFor }
 * @returns {Object} - { promotions, pagination }
 */
export const getAllPromotions = async (query) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    isActive,
    applicableFor,
  } = query;

  // Real-time cleanup: Disable expired promotions
  const now = new Date();
  await Promotion.updateMany(
    { 
      isActive: true, 
      endDate: { $lt: now } 
    },
    { isActive: false }
  );

  // Sanitize pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Build filter
  const filter = {};

  // Search by name or code
  if (search && search.trim()) {
    const searchPattern = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: searchPattern, $options: "i" } },
      { code: { $regex: searchPattern, $options: "i" } },
    ];
  }

  // Filter by isActive
  if (isActive !== undefined) {
    filter.isActive = isActive === "true" || isActive === true;
  }

  // Filter by applicableFor
  if (applicableFor && Object.values(PROMOTION_APPLICABLE_FOR).includes(applicableFor)) {
    filter.applicableFor = applicableFor;
  }

  // Execute query
  const [promotions, total] = await Promise.all([
    Promotion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Promotion.countDocuments(filter),
  ]);

  return {
    promotions,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalItems: total,
      itemsPerPage: limitNum,
    },
  };
};
//#endregion

//#region Get Active Promotions (Public)
/**
 * Lấy danh sách promotions đang hoạt động (public API)
 * @returns {Array} - Active promotions
 */
export const getActivePromotions = async () => {
  const now = new Date();

  const promotions = await Promotion.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { usageLimit: null }, // Unlimited
      { $expr: { $lt: ["$usageCount", "$usageLimit"] } }, // Còn slot
    ],
  })
    .select("-usageCount -createdAt -updatedAt")
    .sort({ discountValue: -1 })
    .lean();

  return promotions;
};
//#endregion

//#region Get Promotion By ID
/**
 * Lấy chi tiết promotion theo ID
 * @param {String} promotionId
 * @returns {Object} - Promotion
 */
export const getPromotionById = async (promotionId) => {
  const promotion = await Promotion.findById(promotionId).lean();

  if (!promotion) {
    throw new NotFoundError("Không tìm thấy khuyến mãi!");
  }

  return promotion;
};
//#endregion

//#region Get Promotion By Code
/**
 * Lấy promotion theo code (cho apply promotion)
 * @param {String} code
 * @returns {Object} - Promotion
 */
export const getPromotionByCode = async (code) => {
  const promotion = await Promotion.findOne({
    code: code.toUpperCase(),
  }).lean();

  if (!promotion) {
    throw new NotFoundError("Mã khuyến mãi không tồn tại!");
  }

  return promotion;
};
//#endregion

//#region Create Promotion (Admin)
/**
 * Tạo promotion mới
 * @param {Object} promotionData
 * @returns {Object} - Created promotion
 */
export const createPromotion = async (promotionData) => {
  try {
    // Auto uppercase code
    if (promotionData.code) {
      promotionData.code = promotionData.code.toUpperCase();
    }

    const promotion = await Promotion.create(promotionData);
    return promotion;
  } catch (error) {
    // Handle duplicate code error
    if (error.code === 11000 && error.keyPattern?.code) {
      throw new ValidationError("Mã khuyến mãi đã tồn tại!");
    }
    throw error;
  }
};
//#endregion

//#region Update Promotion (Admin)
/**
 * Cập nhật promotion
 * @param {String} promotionId
 * @param {Object} updateData
 * @returns {Object} - Updated promotion
 */
export const updatePromotion = async (promotionId, updateData) => {
  // Auto uppercase code if provided
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase();
  }

  try {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!promotion) {
      throw new NotFoundError("Không tìm thấy khuyến mãi!");
    }

    return promotion;
  } catch (error) {
    // Handle duplicate code error
    if (error.code === 11000 && error.keyPattern?.code) {
      throw new ValidationError("Mã khuyến mãi đã tồn tại!");
    }
    throw error;
  }
};
//#endregion

//#region Delete Promotion (Admin)
/**
 * Xóa promotion (soft delete = set isActive = false)
 * @param {String} promotionId
 * @returns {Object} - Success message
 */
export const deletePromotion = async (promotionId) => {
  const promotion = await Promotion.findById(promotionId);

  if (!promotion) {
    throw new NotFoundError("Không tìm thấy khuyến mãi!");
  }

  // Soft delete: Set isActive = false
  promotion.isActive = false;
  await promotion.save();

  return { message: "Xóa khuyến mãi thành công!" };
};
//#endregion

//#region Validate and Apply Promotion (Core Logic)
/**
 * Validate và áp dụng promotion code
 * @param {String} code - Promotion code
 * @param {String} customerId - Customer ID
 * @param {Number} subtotal - Subtotal before discount
 * @returns {Object} - { promotion, discountAmount, finalAmount }
 */
export const validateAndApplyPromotion = async (code, customerId, subtotal) => {
  // 1. Tìm promotion
  const promotion = await Promotion.findOne({
    code: code.toUpperCase(),
  });

  if (!promotion) {
    throw new NotFoundError("Mã khuyến mãi không tồn tại!");
  }

  // 2. Kiểm tra promotion còn valid không
  if (!promotion.isValid()) {
    const now = new Date();

    if (!promotion.isActive) {
      throw new ValidationError("Mã khuyến mãi đã bị vô hiệu hóa!");
    }

    if (now < promotion.startDate) {
      throw new ValidationError("Mã khuyến mãi chưa bắt đầu!");
    }

    if (now > promotion.endDate) {
      throw new ValidationError("Mã khuyến mãi đã hết hạn!");
    }

    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
      throw new ValidationError("Mã khuyến mãi đã hết lượt sử dụng!");
    }
  }

  // 3. Kiểm tra đơn hàng tối thiểu
  if (subtotal < promotion.minOrderValue) {
    throw new ValidationError(
      `Đơn hàng tối thiểu ${promotion.minOrderValue.toLocaleString()} VND để áp dụng mã này!`
    );
  }

  // 4. Kiểm tra đối tượng áp dụng (first_time / return customer)
  if (promotion.applicableFor !== PROMOTION_APPLICABLE_FOR.ALL) {
    const bookingCount = await Booking.countDocuments({
      customerId,
      status: { $in: ["confirmed", "checked_in", "completed"] },
    });

    if (promotion.applicableFor === PROMOTION_APPLICABLE_FOR.FIRST_TIME && bookingCount > 0) {
      throw new ValidationError("Mã khuyến mãi chỉ dành cho khách hàng mới!");
    }

    if (promotion.applicableFor === PROMOTION_APPLICABLE_FOR.RETURN && bookingCount === 0) {
      throw new ValidationError("Mã khuyến mãi chỉ dành cho khách hàng quay lại!");
    }
  }

  // 5. Tính discount amount
  const discountAmount = promotion.calculateDiscount(subtotal);
  const finalAmount = subtotal - discountAmount;

  return {
    promotion: {
      _id: promotion._id,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
    },
    discountAmount,
    finalAmount: Math.max(0, finalAmount), // Không cho âm
  };
};
//#endregion

//#region Increment Usage Count (Called after booking confirmed)
/**
 * Tăng usage count của promotion (gọi sau khi booking thành công)
 * @param {String} promotionId
 * @returns {Object} - Updated promotion
 */
export const incrementPromotionUsage = async (promotionId) => {
  const promotion = await Promotion.findByIdAndUpdate(
    promotionId,
    { $inc: { usageCount: 1 } },
    { new: true }
  );

  if (!promotion) {
    throw new NotFoundError("Không tìm thấy khuyến mãi!");
  }

  return promotion;
};
//#endregion
