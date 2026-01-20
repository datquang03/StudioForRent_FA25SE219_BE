//#region Imports
import Promotion from "../models/Promotion/promotion.model.js";
import Booking from "../models/Booking/booking.model.js";
import { createAndSendNotification } from "../services/notification.service.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { escapeRegex } from "../utils/helpers.js";
import { PROMOTION_APPLICABLE_FOR, NOTIFICATION_TYPE } from "../utils/constants.js";
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

/**
 * Lấy chi tiết promotion đang hoạt động (public API)
 * @param {String} promotionId
 * @returns {Object} - Active promotion detail
 */
export const getActivePromotionDetail = async (promotionId) => {
  const now = new Date();

  const promotion = await Promotion.findOne({
    _id: promotionId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { usageLimit: null }, // Unlimited
      { $expr: { $lt: ["$usageCount", "$usageLimit"] } }, // Còn slot
    ],
  })
    .select("name code description discountType discountValue conditions minOrderValue maxDiscount endDate")
    .lean();

  if (!promotion) {
    throw new NotFoundError("Promotion không khả dụng hoặc không tồn tại!");
  }

  return promotion;
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

    // Notify customers about new promotion (if applicable to all)
    if (promotion.applicableFor === PROMOTION_APPLICABLE_FOR.ALL) {
      // Import User model
      const { User } = await import("../models/index.js");
      const customers = await User.find({ role: "customer", isActive: true }).select("_id");

      // Create notification for each customer (non-blocking)
      customers.forEach(async (customer) => {
        try {
          await createAndSendNotification(
            customer._id,
            NOTIFICATION_TYPE.INFO,
            "New Promotion Available",
            `Check out our new promotion: ${promotion.name} - ${promotion.description}`,
            false,
            null
          );
        } catch (error) {
          // Log but don't fail
          console.error(`Failed to notify customer ${customer._id}:`, error);
        }
      });
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

    // Check budget cap (moved from isValid for better error message)
    if (promotion.maxTotalDiscountAmount !== null && 
        promotion.totalDiscountedAmount >= promotion.maxTotalDiscountAmount) {
      throw new ValidationError("Mã khuyến mãi đã hết ngân sách!");
    }
  }

  // 3. Kiểm tra số lần sử dụng per user (NEW)
  if (promotion.usageLimitPerUser !== null && customerId) {
    const userUsageCount = await Booking.countDocuments({
      userId: customerId,
      promoId: promotion._id,
      status: { $nin: ['cancelled'] } // Chỉ đếm booking không bị hủy
    });

    if (userUsageCount >= promotion.usageLimitPerUser) {
      throw new ValidationError(
        `Bạn đã sử dụng mã này ${userUsageCount} lần. Giới hạn: ${promotion.usageLimitPerUser} lần/người!`
      );
    }
  }

  // 4. Kiểm tra ngày áp dụng trong tuần (NEW)
  if (promotion.applicableDays && promotion.applicableDays.length > 0) {
    const todayDay = new Date().getDay(); // 0=Sunday, 1-6=Monday-Saturday
    if (!promotion.applicableDays.includes(todayDay)) {
      const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const validDays = promotion.applicableDays.map(d => dayNames[d]).join(', ');
      throw new ValidationError(`Mã này chỉ áp dụng vào: ${validDays}!`);
    }
  }

  // 5. Kiểm tra giờ áp dụng trong ngày (NEW)
  if (promotion.applicableHours && 
      promotion.applicableHours.startHour !== undefined && 
      promotion.applicableHours.endHour !== undefined) {
    const currentHour = new Date().getHours();
    const { startHour, endHour } = promotion.applicableHours;
    
    if (currentHour < startHour || currentHour >= endHour) {
      throw new ValidationError(
        `Mã này chỉ áp dụng từ ${startHour}:00 đến trước ${endHour}:00!`
      );
    }
  }

  // 6. Kiểm tra đơn hàng tối thiểu
  if (subtotal < promotion.minOrderValue) {
    throw new ValidationError(
      `Đơn hàng tối thiểu ${promotion.minOrderValue.toLocaleString()} VND để áp dụng mã này!`
    );
  }

  // 7. Kiểm tra đối tượng áp dụng (first_time / return customer)
  if (promotion.applicableFor !== PROMOTION_APPLICABLE_FOR.ALL) {
    const bookingCount = await Booking.countDocuments({
      userId: customerId,
      status: { $in: ["confirmed", "checked_in", "completed"] },
    });

    if (promotion.applicableFor === PROMOTION_APPLICABLE_FOR.FIRST_TIME && bookingCount > 0) {
      throw new ValidationError("Mã khuyến mãi chỉ dành cho khách hàng mới!");
    }

    if (promotion.applicableFor === PROMOTION_APPLICABLE_FOR.RETURN && bookingCount === 0) {
      throw new ValidationError("Mã khuyến mãi chỉ dành cho khách hàng quay lại!");
    }
  }

  // 8. Tính discount amount
  let discountAmount = promotion.calculateDiscount(subtotal);
  
  // Kiểm tra budget còn lại (không cho discount vượt quá remaining budget)
  if (promotion.maxTotalDiscountAmount !== null) {
    const remainingBudget = promotion.maxTotalDiscountAmount - promotion.totalDiscountedAmount;
    
    // Nếu ngân sách đã hết, không cho áp dụng
    if (remainingBudget <= 0) {
      throw new ValidationError("Ngân sách cho mã khuyến mãi này đã hết, vui lòng chọn mã khác!");
    }
    
    // Nếu discount vượt quá budget còn lại, giới hạn theo budget
    if (discountAmount > remainingBudget) {
      discountAmount = remainingBudget;
    }
  }
  
  const finalAmount = subtotal - discountAmount;

  return {
    promotion: {
      _id: promotion._id,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      usageLimitPerUser: promotion.usageLimitPerUser,
      applicableDays: promotion.applicableDays,
      applicableHours: promotion.applicableHours,
    },
    discountAmount,
    finalAmount: Math.max(0, finalAmount), // Không cho âm
  };
};
//#endregion

//#region Increment Usage Count (Called after booking confirmed)
/**
 * Tăng usage count của promotion và tracking total discounted (gọi sau khi booking thành công)
 * @param {String} promotionId - ID của promotion
 * @param {Number} discountAmount - Số tiền đã giảm cho đơn hàng này (để tracking budget)
 * @returns {Object} - Updated promotion
 */
export const incrementPromotionUsage = async (promotionId, discountAmount = 0) => {
  // Validate discountAmount is non-negative to prevent budget cap bypass
  if (discountAmount < 0) discountAmount = 0;
  
  const updateData = { 
    $inc: { 
      usageCount: 1,
      totalDiscountedAmount: discountAmount // Track total discounted for budget cap
    } 
  };

  const promotion = await Promotion.findByIdAndUpdate(
    promotionId,
    updateData,
    { new: true }
  );

  if (!promotion) {
    throw new NotFoundError("Không tìm thấy khuyến mãi!");
  }

  return promotion;
};
//#endregion
