import { TIME_CONSTANTS } from "./constants.js";
import logger from "./logger.js";

/**
 * Sinh mã xác thực ngẫu nhiên
 * @param {number} length - Độ dài mã (mặc định 6)
 * @returns {string} - Mã xác thực
 */
export const generateVerificationCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Tính thời gian hết hạn
 * @param {number} minutes - Số phút
 * @returns {number} - Timestamp hết hạn
 */
export const getExpiryTime = (minutes = TIME_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES) => {
  return Date.now() + minutes * 60 * 1000;
};

/**
 * Kiểm tra xem thời gian đã hết hạn chưa
 * @param {number|Date} expiryTime - Thời gian hết hạn
 * @returns {boolean} - true nếu đã hết hạn
 */
export const isExpired = (expiryTime) => {
  return expiryTime < Date.now();
};

/**
 * Format date thành ISO string
 * @param {Date|number} date - Date object hoặc timestamp
 * @returns {string} - ISO string
 */
export const formatDate = (date) => {
  return new Date(date).toISOString();
};

/**
 * Loại bỏ các trường nhạy cảm khỏi object user
 * @param {Object} user - User object
 * @param {Array} fields - Các trường cần loại bỏ
 * @returns {Object} - User object đã được filter
 */
export const sanitizeUser = (user, fields = ["password", "passwordHash", "verificationCode", "verificationCodeExpires"]) => {
  const sanitized = { ...user };
  fields.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
};

/**
 * Chuyển đổi user document thành plain object và loại bỏ sensitive fields
 * @param {Object} userDoc - Mongoose document (Customer or Account)
 * @returns {Object} - Plain object
 */
export const toUserResponse = (userDoc) => {
  const userObj = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    id: userObj._id,
    username: userObj.username,
    email: userObj.email,
    fullName: userObj.fullName,
    phone: userObj.phone,
    role: userObj.role || "customer", // Default to customer for Customer model
    isVerified: userObj.isVerified,
    isActive: userObj.isActive !== undefined ? userObj.isActive : true,
    avatarUrl: userObj.avatarUrl,
    createdAt: userObj.createdAt,
  };
};

/**
 * Tạo response object chuẩn
 * @param {boolean} success - Trạng thái thành công
 * @param {string} message - Thông báo
 * @param {Object} data - Dữ liệu (optional)
 * @returns {Object} - Response object
 */
export const createResponse = (success, message, data = null) => {
  const response = { success, message };
  if (data !== null) {
    response.data = data;
  }
  return response;
};

/**
 * Delay execution (for testing or rate limiting)
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
export const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Tạo slug từ string
 * @param {string} str - String cần chuyển đổi
 * @returns {string} - Slug
 */
export const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Random một phần tử từ array
 * @param {Array} array - Mảng
 * @returns {*} - Phần tử ngẫu nhiên
 */
export const randomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Tính tổng giá trị trong array
 * @param {Array} array - Mảng số
 * @returns {number} - Tổng
 */
export const sum = (array) => {
  return array.reduce((acc, val) => acc + val, 0);
};

/**
 * Group array by key
 * @param {Array} array - Array of objects
 * @param {string} key - Key to group by
 * @returns {Object} - Grouped object
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};

/**
 * Escape special regex characters to prevent regex injection attacks
 * @param {string} string - String to escape
 * @returns {string} - Escaped string safe for use in RegExp
 */
export const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

//#endregion

//#region Environment Utilities
/**
 * ============================================
 * ENVIRONMENT VALIDATION UTILITIES
 * Validate required environment variables
 * ============================================
 */

/**
 * Validate required environment variables
 * @param {string[]} requiredVars - Array of required environment variable names
 * @returns {boolean} - true if all variables are present
 */
export const validateEnvironmentVariables = (requiredVars) => {
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please create a .env file with these variables');
    return false;
  }

  logger.info('Environment variables validation passed');
  return true;
};

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {*} fallback - Fallback value
 * @returns {*} - Environment variable value or fallback
 */
export const getEnvVar = (key, fallback = null) => {
  return process.env[key] || fallback;
};

//#endregion
