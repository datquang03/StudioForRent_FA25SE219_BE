//#region Imports
import { isValidEmail, isValidPassword, isNotEmpty } from "../utils/validators.js";
import { VALIDATION_MESSAGES, REGEX_PATTERNS } from "../utils/constants.js";
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
  const { username, email, fullName, position, phone } = req.body;

  if (!isNotEmpty(username) || !isNotEmpty(email) || !isNotEmpty(fullName) || !isNotEmpty(position)) {
    return res.status(400).json(
      createResponse(false, 'Vui lòng nhập đầy đủ thông tin: username, email, fullName, position!')
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

  if (!['staff', 'admin'].includes(position)) {
    return res.status(400).json(
      createResponse(false, 'Position phải là "staff" hoặc "admin"!')
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
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;

    if (!objectIdPattern.test(id)) {
      return res.status(400).json(
        createResponse(false, `${paramName} không hợp lệ!`)
      );
    }

    next();
  };
};
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

  next();
};
//#endregion
