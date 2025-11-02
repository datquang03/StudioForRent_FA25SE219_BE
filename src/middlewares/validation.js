import { VALIDATION_MESSAGES, REGEX_PATTERNS } from '../utils/constants.js';

// Helper function để validate email
export const validateEmail = (email) => {
  if (!email) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED_EMAIL };
  }
  if (!REGEX_PATTERNS.EMAIL.test(email)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_EMAIL };
  }
  return { isValid: true };
};

// Helper function để validate password
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED_PASSWORD };
  }
  if (!REGEX_PATTERNS.PASSWORD.test(password)) {
    return { isValid: false, message: VALIDATION_MESSAGES.WEAK_PASSWORD };
  }
  return { isValid: true };
};

// Helper function để validate phone
export const validatePhone = (phone) => {
  if (phone && !REGEX_PATTERNS.PHONE.test(phone)) {
    return { isValid: false, message: 'Số điện thoại không hợp lệ!' };
  }
  return { isValid: true };
};

// Middleware validate registration
export const validateRegistration = (req, res, next) => {
  const { username, email, password, fullName } = req.body;
  
  // Check required fields
  if (!username || !email || !password || !fullName) {
    return res.status(400).json({
      success: false,
      message: VALIDATION_MESSAGES.MISSING_FIELDS,
    });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.message,
    });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: passwordValidation.message,
    });
  }

  // Validate phone (optional)
  if (req.body.phone) {
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message,
      });
    }
  }

  // Validate username length
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      success: false,
      message: 'Tên đăng nhập phải từ 3-30 ký tự!',
    });
  }

  next();
};

// Middleware validate staff registration (không cần password)
export const validateStaffRegistration = (req, res, next) => {
  const { username, email, fullName, position } = req.body;
  
  // Check required fields (không có password)
  if (!username || !email || !fullName || !position) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập đầy đủ thông tin: username, email, fullName, position!',
    });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.message,
    });
  }

  // Validate phone (optional)
  if (req.body.phone) {
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message,
      });
    }
  }

  // Validate username length
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      success: false,
      message: 'Tên đăng nhập phải từ 3-30 ký tự!',
    });
  }

  // Validate position
  if (!['staff', 'admin'].includes(position)) {
    return res.status(400).json({
      success: false,
      message: 'Position phải là "staff" hoặc "admin"!',
    });
  }

  next();
};

// Middleware validate login
export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: VALIDATION_MESSAGES.MISSING_FIELDS,
    });
  }

  next();
};

// Middleware validate email verification
export const validateEmailVerification = (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: VALIDATION_MESSAGES.MISSING_FIELDS,
    });
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.message,
    });
  }

  if (!REGEX_PATTERNS.VERIFICATION_CODE.test(code)) {
    return res.status(400).json({
      success: false,
      message: VALIDATION_MESSAGES.INVALID_CODE_LENGTH,
    });
  }

  next();
};

// Middleware validate refresh token
export const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required!',
    });
  }

  next();
};

// Generic sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Remove any HTML tags from input
  const sanitizeString = (str) => {
    if (typeof str === 'string') {
      return str.replace(/<[^>]*>?/gm, '').trim();
    }
    return str;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = sanitizeString(req.body[key]);
    });
  }

  // Sanitize query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      req.query[key] = sanitizeString(req.query[key]);
    });
  }

  // Sanitize params
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      req.params[key] = sanitizeString(req.params[key]);
    });
  }

  next();
};
