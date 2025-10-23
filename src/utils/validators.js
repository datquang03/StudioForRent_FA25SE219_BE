import { REGEX_PATTERNS } from "./constants.js";

/**
 * Kiểm tra email hợp lệ
 * @param {string} email - Email cần kiểm tra
 * @returns {boolean} - true nếu email hợp lệ
 */
export const isValidEmail = (email) => {
  return REGEX_PATTERNS.EMAIL.test(email);
};

/**
 * Kiểm tra mật khẩu mạnh
 * Yêu cầu: ít nhất 8 ký tự, có chữ hoa, chữ thường và số
 * @param {string} password - Mật khẩu cần kiểm tra
 * @returns {boolean} - true nếu mật khẩu mạnh
 */
export const isValidPassword = (password) => {
  return REGEX_PATTERNS.PASSWORD.test(password);
};

/**
 * Kiểm tra số điện thoại hợp lệ
 * @param {string} phone - Số điện thoại cần kiểm tra
 * @returns {boolean} - true nếu số điện thoại hợp lệ
 */
export const isValidPhone = (phone) => {
  return REGEX_PATTERNS.PHONE.test(phone);
};

/**
 * Kiểm tra mã xác thực hợp lệ (6 chữ số)
 * @param {string} code - Mã xác thực cần kiểm tra
 * @returns {boolean} - true nếu mã xác thực hợp lệ
 */
export const isValidVerificationCode = (code) => {
  return REGEX_PATTERNS.VERIFICATION_CODE.test(code);
};

/**
 * Kiểm tra chuỗi không rỗng
 * @param {string} str - Chuỗi cần kiểm tra
 * @returns {boolean} - true nếu chuỗi không rỗng
 */
export const isNotEmpty = (str) => {
  return str && str.trim().length > 0;
};

/**
 * Kiểm tra giá trị có phải là số dương
 * @param {number} value - Giá trị cần kiểm tra
 * @returns {boolean} - true nếu là số dương
 */
export const isPositiveNumber = (value) => {
  return typeof value === "number" && value > 0;
};

/**
 * Kiểm tra ObjectId hợp lệ của MongoDB
 * @param {string} id - ID cần kiểm tra
 * @returns {boolean} - true nếu ObjectId hợp lệ
 */
export const isValidObjectId = (id) => {
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(id);
};
