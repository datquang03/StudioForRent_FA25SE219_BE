import { REGEX_PATTERNS, REPORT_STATUS } from "./constants.js";
import { ValidationError } from './errors.js';

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

// Define allowed transitions
export const REPORT_TRANSITIONS = {
  [REPORT_STATUS.PENDING]: [REPORT_STATUS.IN_PROGRESS, REPORT_STATUS.CLOSED, REPORT_STATUS.RESOLVED],
  [REPORT_STATUS.IN_PROGRESS]: [REPORT_STATUS.RESOLVED, REPORT_STATUS.PENDING, REPORT_STATUS.CLOSED],
  [REPORT_STATUS.RESOLVED]: [REPORT_STATUS.CLOSED, REPORT_STATUS.IN_PROGRESS],
  [REPORT_STATUS.CLOSED]: [] // Final state
};

// Refund transitions (hardcoded strings in model currently, matching here)
export const REFUND_TRANSITIONS = {
  'PENDING_APPROVAL': ['APPROVED', 'REJECTED'],
  'APPROVED': ['COMPLETED', 'PENDING_APPROVAL'],
  'REJECTED': ['PENDING_APPROVAL'],
  'COMPLETED': [] // Final state
};

/**
 * Validate status transition
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Target status
 * @param {object} allowedTransitions - Map of current status to allowed next statuses
 * @param {string} entityName - Name of entity for error message
 */
export const validateStatusTransition = (currentStatus, newStatus, allowedTransitions, entityName = 'Entity') => {
  if (!currentStatus || !newStatus) return;
  if (currentStatus === newStatus) return;

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Không thể chuyển trạng thái ${entityName} từ '${currentStatus}' sang '${newStatus}'. ` +
      `Các trạng thái hợp lệ tiếp theo: ${allowed.join(', ')}`
    );
  }
};
