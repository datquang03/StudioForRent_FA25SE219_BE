//#region Imports
import mongoose from 'mongoose';
import { isValidEmail, isValidPassword, isNotEmpty } from "../utils/validators.js";
import { VALIDATION_MESSAGES, REGEX_PATTERNS, SERVICE_STATUS } from "../utils/constants.js";
import { createResponse } from "../utils/helpers.js";
//#endregion

//#region Authentication Validators
/**
 * Validate dữ liệu đăng ký
 */
export const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  // Check required fields
  if (!isNotEmpty(username)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_USERNAME)
    );
  }

  if (!isNotEmpty(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_EMAIL)
    );
  }

  if (!isNotEmpty(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_PASSWORD)
    );
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.WEAK_PASSWORD)
    );
  }

  next();
};

/**
 * Validate dữ liệu đăng nhập
 */
export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!isNotEmpty(username)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_USERNAME)
    );
  }

  if (!isNotEmpty(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_PASSWORD)
    );
  }

  next();
};

/**
 * Validate dữ liệu đổi mật khẩu
 */
export const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!isNotEmpty(oldPassword)) {
    return res.status(400).json(
      createResponse(false, "Vui lòng điền mật khẩu cũ!")
    );
  }

  if (!isNotEmpty(newPassword)) {
    return res.status(400).json(
      createResponse(false, "Vui lòng điền mật khẩu mới!")
    );
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.WEAK_PASSWORD)
    );
  }

  next();
};

export const validateRegistration = (req, res, next) => {
  const { username, email, password, fullName, phone } = req.body;

  if (!isNotEmpty(username)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_USERNAME)
    );
  }

  if (!isNotEmpty(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_EMAIL)
    );
  }

  if (!isNotEmpty(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_PASSWORD)
    );
  }

  if (!isNotEmpty(fullName)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_FULLNAME)
    );
  }

  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  if (!isValidPassword(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.WEAK_PASSWORD)
    );
  }

  if (phone && !REGEX_PATTERNS.PHONE.test(phone)) {
    return res.status(400).json(
      createResponse(false, 'Số điện thoại không hợp lệ!')
    );
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json(
      createResponse(false, 'Tên đăng nhập phải từ 3-30 ký tự!')
    );
  }

  next();
};

export const validateStaffRegistration = (req, res, next) => {
  const { username, email, fullName, phone } = req.body;

  if (!isNotEmpty(username) || !isNotEmpty(email) || !isNotEmpty(fullName)) {
    return res.status(400).json(
      createResponse(false, 'Vui lòng nhập đầy đủ thông tin: username, email, fullName!')
    );
  }

  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  if (phone && !REGEX_PATTERNS.PHONE.test(phone)) {
    return res.status(400).json(
      createResponse(false, 'Số điện thoại không hợp lệ!')
    );
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json(
      createResponse(false, 'Tên đăng nhập phải từ 3-30 ký tự!')
    );
  }

  next();
};

export const validateEmailVerification = (req, res, next) => {
  const { email, code } = req.body;

  if (!isNotEmpty(email) || !isNotEmpty(code)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.MISSING_FIELDS)
    );
  }

  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  if (!REGEX_PATTERNS.VERIFICATION_CODE.test(code)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_CODE_LENGTH)
    );
  }

  next();
};

export const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!isNotEmpty(refreshToken)) {
    return res.status(400).json(
      createResponse(false, 'Refresh token is required!')
    );
  }

  next();
};
//#endregion

//#region General Validators
//#endregion

//#region Studio Validators
export const validateStudioCreation = (req, res, next) => {
  const { name, basePricePerHour, capacity, area } = req.body;

  if (!isNotEmpty(name)) {
    return res.status(400).json(
      createResponse(false, 'Tên studio không được để trống!')
    );
  }

  if (basePricePerHour === undefined || basePricePerHour === null) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê theo giờ không được để trống!')
    );
  }

  if (typeof basePricePerHour !== 'number' || basePricePerHour < 0) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê phải là số dương!')
    );
  }

  if (capacity !== undefined && (typeof capacity !== 'number' || capacity < 0)) {
    return res.status(400).json(
      createResponse(false, 'Sức chứa phải là số dương!')
    );
  }

  if (area !== undefined && (typeof area !== 'number' || area < 0)) {
    return res.status(400).json(
      createResponse(false, 'Diện tích phải là số dương!')
    );
  }

  next();
};

export const validateStudioUpdate = (req, res, next) => {
  const { name, basePricePerHour, capacity, area } = req.body;

  if (name !== undefined && !isNotEmpty(name)) {
    return res.status(400).json(
      createResponse(false, 'Tên studio không được để trống!')
    );
  }

  if (basePricePerHour !== undefined && (typeof basePricePerHour !== 'number' || basePricePerHour < 0)) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê phải là số dương!')
    );
  }

  if (capacity !== undefined && (typeof capacity !== 'number' || capacity < 0)) {
    return res.status(400).json(
      createResponse(false, 'Sức chứa phải là số dương!')
    );
  }

  if (area !== undefined && (typeof area !== 'number' || area < 0)) {
    return res.status(400).json(
      createResponse(false, 'Diện tích phải là số dương!')
    );
  }

  next();
};
//#endregion

//#region Equipment Validators
/**
 * Validate dữ liệu tạo equipment mới
 */
export const validateEquipmentCreation = (req, res, next) => {
  const { name, pricePerHour, totalQty } = req.body;

  if (!isNotEmpty(name)) {
    return res.status(400).json(
      createResponse(false, 'Tên equipment không được để trống!')
    );
  }

  if (pricePerHour === undefined || pricePerHour === null) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê theo giờ không được để trống!')
    );
  }

  if (typeof pricePerHour !== 'number' || pricePerHour < 0) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê phải là số >= 0!')
    );
  }

  if (totalQty === undefined || totalQty === null) {
    return res.status(400).json(
      createResponse(false, 'Số lượng không được để trống!')
    );
  }

  if (typeof totalQty !== 'number' || totalQty < 0 || !Number.isInteger(totalQty)) {
    return res.status(400).json(
      createResponse(false, 'Số lượng phải là số nguyên >= 0!')
    );
  }

  next();
};

/**
 * Validate dữ liệu cập nhật equipment
 */
export const validateEquipmentUpdate = (req, res, next) => {
  const { name, pricePerHour, totalQty } = req.body;

  if (name !== undefined && !isNotEmpty(name)) {
    return res.status(400).json(
      createResponse(false, 'Tên equipment không được để trống!')
    );
  }

  if (pricePerHour !== undefined && (typeof pricePerHour !== 'number' || pricePerHour < 0)) {
    return res.status(400).json(
      createResponse(false, 'Giá thuê phải là số >= 0!')
    );
  }

  if (totalQty !== undefined && (typeof totalQty !== 'number' || totalQty < 0 || !Number.isInteger(totalQty))) {
    return res.status(400).json(
      createResponse(false, 'Số lượng phải là số nguyên >= 0!')
    );
  }

  next();
};

/**
 * Validate số lượng equipment đang bảo trì
 */
export const validateMaintenanceQuantity = (req, res, next) => {
  const { quantity } = req.body;

  if (quantity === undefined || quantity === null) {
    return res.status(400).json(
      createResponse(false, 'Vui lòng nhập số lượng maintenance!')
    );
  }

  if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
    return res.status(400).json(
      createResponse(false, 'Số lượng maintenance phải là số nguyên >= 0!')
    );
  }

  next();
};
//#endregion

//#region Sanitization
/**
 * Sanitize input để ngăn chặn XSS và NoSQL injection
 * Đơn giản và hiệu quả
 */
export const sanitizeInput = (req, res, next) => {
  // Hàm sanitize chuỗi: loại bỏ HTML tags và MongoDB operators
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // 1. Loại bỏ HTML tags (chống XSS)
    let clean = str.replace(/<[^>]*>/g, '');
    
    // 2. Loại bỏ MongoDB operators ($gt, $ne, $where...)
    clean = clean.replace(/\$/g, '');
    
    // 3. Trim khoảng trắng thừa
    return clean.trim();
  };

  try {
    // Sanitize body (POST/PUT/PATCH data)
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach(key => {
        req.body[key] = sanitizeString(req.body[key]);
      });
    }

    // Sanitize query params (GET ?search=...)
    if (req.query && typeof req.query === 'object') {
      Object.keys(req.query).forEach(key => {
        req.query[key] = sanitizeString(req.query[key]);
      });
    }

    // Sanitize URL params (/:id)
    if (req.params && typeof req.params === 'object') {
      Object.keys(req.params).forEach(key => {
        req.params[key] = sanitizeString(req.params[key]);
      });
    }
  } catch (error) {
    console.error('Sanitize Input Error:', error);
    return next(error);
  }

  next();
};

//#region Service Validation

/**
 * Validate tạo service mới
 */
export const validateServiceCreation = (req, res, next) => {
  const { name, pricePerUse, description } = req.body;

  // Required fields
  if (!name || !name.trim()) {
    return res.status(400).json(
      createResponse(false, 'Tên dịch vụ là bắt buộc!')
    );
  }

  if (pricePerUse === undefined || pricePerUse === null) {
    return res.status(400).json(
      createResponse(false, 'Giá dịch vụ là bắt buộc!')
    );
  }

  // Validate types
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json(
      createResponse(false, 'Tên dịch vụ không hợp lệ!')
    );
  }

  if (typeof pricePerUse !== 'number' || pricePerUse < 0) {
    return res.status(400).json(
      createResponse(false, 'Giá dịch vụ phải là số >= 0!')
    );
  }

  // Validate description if provided
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json(
      createResponse(false, 'Mô tả dịch vụ phải là chuỗi!')
    );
  }

  next();
};

/**
 * Validate cập nhật service
 */
export const validateServiceUpdate = (req, res, next) => {
  const { name, pricePerUse, status, description } = req.body;

  // At least one field required
  if (!name && pricePerUse === undefined && status === undefined && description === undefined) {
    return res.status(400).json(
      createResponse(false, 'Vui lòng cung cấp ít nhất một trường để cập nhật!')
    );
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json(
      createResponse(false, 'Tên dịch vụ không hợp lệ!')
    );
  }

  // Validate price if provided
  if (pricePerUse !== undefined && (typeof pricePerUse !== 'number' || pricePerUse < 0)) {
    return res.status(400).json(
      createResponse(false, 'Giá dịch vụ phải là số >= 0!')
    );
  }

  // Validate status if provided
  if (status !== undefined) {
    const validStatuses = Object.values(SERVICE_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json(
        createResponse(false, `Trạng thái không hợp lệ! Chỉ chấp nhận: ${validStatuses.join(', ')}`)
      );
    }
  }

  // Validate description if provided
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json(
      createResponse(false, 'Mô tả dịch vụ phải là chuỗi!')
    );
  }

  next();
};

//#endregion

//#region Promotion Validators

/**
 * Validate tạo promotion mới
 */
export const validatePromotionCreation = (req, res, next) => {
  const { name, code, discountType, discountValue, maxDiscount, startDate, endDate } = req.body;

  // Required fields
  if (!name || !name.trim()) {
    return res.status(400).json(
      createResponse(false, 'Tên khuyến mãi là bắt buộc!')
    );
  }

  if (!code || !code.trim()) {
    return res.status(400).json(
      createResponse(false, 'Mã khuyến mãi là bắt buộc!')
    );
  }

  if (!discountType) {
    return res.status(400).json(
      createResponse(false, 'Loại giảm giá là bắt buộc!')
    );
  }

  if (discountValue === undefined || discountValue === null) {
    return res.status(400).json(
      createResponse(false, 'Giá trị giảm là bắt buộc!')
    );
  }

  if (!startDate) {
    return res.status(400).json(
      createResponse(false, 'Ngày bắt đầu là bắt buộc!')
    );
  }

  if (!endDate) {
    return res.status(400).json(
      createResponse(false, 'Ngày kết thúc là bắt buộc!')
    );
  }

  // Validate code format (6-20 chars, uppercase, numbers only)
  const codePattern = /^[A-Z0-9]{6,20}$/;
  if (!codePattern.test(code.toUpperCase())) {
    return res.status(400).json(
      createResponse(false, 'Mã khuyến mãi chỉ chấp nhận chữ HOA và số, từ 6-20 ký tự!')
    );
  }

  // Validate discountType
  const validDiscountTypes = ['percentage', 'fixed'];
  if (!validDiscountTypes.includes(discountType)) {
    return res.status(400).json(
      createResponse(false, 'Loại giảm giá không hợp lệ! Chỉ chấp nhận: percentage, fixed')
    );
  }

  // Validate discountValue
  if (typeof discountValue !== 'number' || discountValue < 0) {
    return res.status(400).json(
      createResponse(false, 'Giá trị giảm phải là số >= 0!')
    );
  }

  // Nếu là percentage, phải từ 0-100 và có maxDiscount
  if (discountType === 'percentage') {
    if (discountValue > 100) {
      return res.status(400).json(
        createResponse(false, 'Giảm theo % phải từ 0-100!')
      );
    }

    if (!maxDiscount || maxDiscount <= 0) {
      return res.status(400).json(
        createResponse(false, 'Giảm theo % phải có giá trị giảm tối đa (maxDiscount)!')
      );
    }

    if (typeof maxDiscount !== 'number') {
      return res.status(400).json(
        createResponse(false, 'Giá trị giảm tối đa phải là số!')
      );
    }
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return res.status(400).json(
      createResponse(false, 'Ngày bắt đầu không hợp lệ!')
    );
  }

  if (isNaN(end.getTime())) {
    return res.status(400).json(
      createResponse(false, 'Ngày kết thúc không hợp lệ!')
    );
  }

  if (end <= start) {
    return res.status(400).json(
      createResponse(false, 'Ngày kết thúc phải sau ngày bắt đầu!')
    );
  }

  next();
};

/**
 * Validate cập nhật promotion
 */
export const validatePromotionUpdate = (req, res, next) => {
  const { name, code, discountType, discountValue, maxDiscount, startDate, endDate } = req.body;

  // At least one field required
  if (!name && !code && !discountType && discountValue === undefined && 
      maxDiscount === undefined && !startDate && !endDate && 
      req.body.minOrderValue === undefined && req.body.usageLimit === undefined && 
      req.body.isActive === undefined && req.body.applicableFor === undefined) {
    return res.status(400).json(
      createResponse(false, 'Vui lòng cung cấp ít nhất một trường để cập nhật!')
    );
  }

  // Validate name if provided
  if (name !== undefined && (!name || !name.trim())) {
    return res.status(400).json(
      createResponse(false, 'Tên khuyến mãi không được để trống!')
    );
  }

  // Validate code if provided
  if (code !== undefined) {
    if (!code || !code.trim()) {
      return res.status(400).json(
        createResponse(false, 'Mã khuyến mãi không được để trống!')
      );
    }

    const codePattern = /^[A-Z0-9]{6,20}$/;
    if (!codePattern.test(code.toUpperCase())) {
      return res.status(400).json(
        createResponse(false, 'Mã khuyến mãi chỉ chấp nhận chữ HOA và số, từ 6-20 ký tự!')
      );
    }
  }

  // Validate discountType if provided
  if (discountType !== undefined) {
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json(
        createResponse(false, 'Loại giảm giá không hợp lệ! Chỉ chấp nhận: percentage, fixed')
      );
    }
  }

  // Validate discountValue if provided
  if (discountValue !== undefined) {
    if (typeof discountValue !== 'number' || discountValue < 0) {
      return res.status(400).json(
        createResponse(false, 'Giá trị giảm phải là số >= 0!')
      );
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json(
        createResponse(false, 'Giảm theo % phải từ 0-100!')
      );
    }
  }

  // Validate maxDiscount if provided
  if (maxDiscount !== undefined && (typeof maxDiscount !== 'number' || maxDiscount < 0)) {
    return res.status(400).json(
      createResponse(false, 'Giá trị giảm tối đa phải là số >= 0!')
    );
  }

  // Validate dates if provided
  if (startDate !== undefined || endDate !== undefined) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && isNaN(start.getTime())) {
      return res.status(400).json(
        createResponse(false, 'Ngày bắt đầu không hợp lệ!')
      );
    }

    if (end && isNaN(end.getTime())) {
      return res.status(400).json(
        createResponse(false, 'Ngày kết thúc không hợp lệ!')
      );
    }

    if (start && end && end <= start) {
      return res.status(400).json(
        createResponse(false, 'Ngày kết thúc phải sau ngày bắt đầu!')
      );
    }
  }

  // Validate applicableFor if provided
  if (req.body.applicableFor !== undefined) {
    const validApplicableFor = ['all', 'first_time', 'return'];
    if (!validApplicableFor.includes(req.body.applicableFor)) {
      return res.status(400).json(
        createResponse(false, 'Đối tượng áp dụng không hợp lệ! Chỉ chấp nhận: all, first_time, return')
      );
    }
  }

  next();
};

/**
 * Validate promotion code format (cho apply promotion)
 */
export const validatePromotionCode = (req, res, next) => {
  const code = req.params.code || req.body.code;

  if (!code || !code.trim()) {
    return res.status(400).json(
      createResponse(false, 'Mã khuyến mãi là bắt buộc!')
    );
  }

  const codePattern = /^[A-Z0-9]{6,20}$/;
  if (!codePattern.test(code.toUpperCase())) {
    return res.status(400).json(
      createResponse(false, 'Mã khuyến mãi không hợp lệ!')
    );
  }

  next();
};

//#endregion

//#region ObjectId Validator

/**
 * Validate MongoDB ObjectId
 * @param {string} paramName - Name of the parameter to validate (default: 'id')
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json(
        createResponse(false, `${paramName} là bắt buộc!`)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(
        createResponse(false, `${paramName} không hợp lệ!`)
      );
    }

    next();
  };
};

//#endregion

