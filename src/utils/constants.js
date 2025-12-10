// Set Design Categories
export const SET_DESIGN_CATEGORIES = [
  'wedding',
  'portrait',
  'corporate',
  'event',
  'family',
  'graduation',
  'other'
];
// #region Response Messages

// Authentication Messages
export const AUTH_MESSAGES = {
  // Success messages
  REGISTER_SUCCESS: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
  LOGIN_SUCCESS: "Đăng nhập thành công!",
  VERIFY_SUCCESS: "Xác thực email thành công!",
  RESEND_CODE_SUCCESS: "Mã xác thực mới đã được gửi đến email của bạn.",

  // Error messages
  INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không chính xác!",
  USER_NOT_FOUND: "Người dùng không tồn tại!",
  EMAIL_EXISTS: "Email đã được sử dụng!",
  USERNAME_EXISTS: "Tên đăng nhập đã tồn tại!",
  ALREADY_VERIFIED: "Tài khoản đã được xác thực!",
  NOT_VERIFIED: "Tài khoản chưa được xác thực, vui lòng kiểm tra email!",
  CODE_EXPIRED: "Mã xác thực đã hết hạn, vui lòng gửi lại mã mới!",
  INVALID_CODE: "Mã xác thực không đúng!",
  UNAUTHORIZED: "Không có quyền truy cập!",
  TOKEN_INVALID: "Token không hợp lệ!",
  TOKEN_MISSING: "Không có token, từ chối truy cập!",
  ACCOUNT_INACTIVE: "Tài khoản đã bị vô hiệu hóa!",
  INVALID_REFRESH_TOKEN: "Refresh token không hợp lệ hoặc đã hết hạn!",
  LOGOUT_SUCCESS: "Đăng xuất thành công!",
};

// Validation Messages
export const VALIDATION_MESSAGES = {
  REQUIRED_USERNAME: "Vui lòng điền tên đăng nhập!",
  REQUIRED_EMAIL: "Vui lòng điền email!",
  REQUIRED_PASSWORD: "Vui lòng điền mật khẩu!",
  REQUIRED_FULLNAME: "Vui lòng điền họ tên!",
  REQUIRED_CODE: "Vui lòng điền mã xác thực!",
  INVALID_EMAIL: "Email không hợp lệ!",
  WEAK_PASSWORD: "Mật khẩu phải ít nhất 8 ký tự, có chữ hoa, chữ thường và số!",
  INVALID_CODE_LENGTH: "Mã xác thực phải có 6 chữ số!",
  INVALID_DATA: "Thông tin không hợp lệ!",
  MISSING_FIELDS: "Vui lòng điền đầy đủ thông tin!",
};

// Rate Limit Messages
export const RATE_LIMIT_MESSAGES = {
  AUTH_LIMIT: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút!",
  LOGIN_LIMIT: "Quá nhiều lần đăng nhập thất bại. Tài khoản tạm thời bị khóa 15 phút để bảo mật!",
  VERIFICATION_LIMIT: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 5 phút!",
  PASSWORD_RESET_LIMIT: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 30 phút!",
  ADMIN_LIMIT: "Quá nhiều yêu cầu admin. Vui lòng thử lại sau!",
  GENERAL_LIMIT: "Quá nhiều yêu cầu. Vui lòng thử lại sau!",
};

// User Management Messages
export const USER_MESSAGES = {
  USER_NOT_FOUND: "Người dùng không tồn tại!",
  UPDATE_SUCCESS: "Cập nhật thông tin thành công!",
  DELETE_SUCCESS: "Xóa tài khoản thành công!",
};

// #endregion

// #region Enums

// User & Authentication
export const USER_ROLES = {
  CUSTOMER: "customer",
  STAFF: "staff",
  ADMIN: "admin",
};

export const STAFF_POSITIONS = {
  STAFF: "staff",
  ADMIN: "admin",
};

// Studio & Resources
export const STUDIO_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  MAINTENANCE: "maintenance",
};

export const EQUIPMENT_STATUS = {
  AVAILABLE: "available",
  IN_USE: "in_use",
  MAINTENANCE: "maintenance",
};

export const SERVICE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

// Scheduling
export const SCHEDULE_STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  CANCELLED: "cancelled",
};

// Booking
export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in", // NEW: Added checked-in status
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const BOOKING_EVENT_TYPE = {
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
  CHARGE_APPLIED: 'CHARGE_APPLIED',
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT'
};

// Booking Detail Types (for booking_details table)
export const BOOKING_DETAIL_TYPE = {
  EQUIPMENT: "equipment",
  EXTRA_SERVICE: "extra_service",
};

// Payment Types
export const PAY_TYPE = {
  FULL: "full",
  PREPAY_30: "prepay_30",
  PREPAY_50: "prepay_50",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid", // Changed from SUCCESS to PAID
  FAILED: "failed",
  REFUNDED: "refunded",
};

// Promotions
export const DISCOUNT_TYPE = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
};

export const PROMOTION_APPLICABLE_FOR = {
  ALL: "all",                    // Tất cả khách hàng
  FIRST_TIME: "first_time",      // Khách hàng mới (chưa có booking nào)
  RETURN: "return",              // Khách hàng quay lại (đã có booking)
};

// AI Set Design (Updated workflow)
export const AI_SET_DESIGN_STATUS = {
  DRAFTING: "drafting", // Khách đang tạo/chọn ảnh AI
  DESIGN_APPROVED: "design_approved", // Khách đã chốt ảnh
  STAFF_CONFIRMED: "staff_confirmed", // Staff xác nhận + báo giá
  PENDING_IMPLEMENTATION: "pending_implementation", // Đang dựng
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// Review & Report
export const REVIEW_TARGET_TYPES = {
  STUDIO: "Studio",
  SET_DESIGN: "SetDesign",
  SERVICE: "Service",
};

export const COMMENT_TARGET_TYPES = {
  STUDIO: "Studio",
  SET_DESIGN: "SetDesign",
};

export const REPORT_STATUS = {
  PENDING: "pending", // Changed from OPEN
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

export const REPORT_ISSUE_TYPE = {
  EQUIPMENT: "equipment",
  STUDIO: "studio",
  STAFF: "staff",
  OTHER: "other",
  DAMAGE: "damage",
  COMPLAINT: "complaint",
  MISSING_ITEM: "missing_item",
  INAPPROPRIATE_CONTENT: "inappropriate_content", // For reporting reviews/comments
};

export const REPORT_TARGET_TYPES = {
  BOOKING: "Booking",
  REVIEW: "Review",
  COMMENT: "Comment",
};

// Notifications
export const NOTIFICATION_TYPE = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  SUCCESS: "success",
  CONFIRMATION: "confirmation",
  CHANGE: "change",
  REMINDER: "reminder",
  NEW_REVIEW: "new_review",
  REPLY_REVIEW: "reply_review",
  REPLY_COMMENT: "reply_comment",
};

// #endregion

// #region Time Constants

export const TIME_CONSTANTS = {
  VERIFICATION_CODE_EXPIRY: 15 * 60 * 1000, // 15 minutes in milliseconds
  VERIFICATION_CODE_EXPIRY_MINUTES: 15,
  JWT_EXPIRY: "1d", // Access token: 15 minutes // Updated to 1 day to test
  REFRESH_TOKEN_EXPIRY: "7d", // Refresh token: 7 days
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
};

// #endregion

// #region Rate Limit Configuration

export const RATE_LIMIT_CONFIG = {
  // Authentication endpoints
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 phút
  AUTH_MAX_REQUESTS: 5, // 5 requests
  
  // Login endpoint (stricter)
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 phút
  LOGIN_MAX_REQUESTS: 10, // 10 requests
  
  // Verification code endpoints
  VERIFICATION_WINDOW_MS: 5 * 60 * 1000, // 5 phút
  VERIFICATION_MAX_REQUESTS: 3, // 3 requests
  
  // Password reset endpoints
  PASSWORD_RESET_WINDOW_MS: 30 * 60 * 1000, // 30 phút
  PASSWORD_RESET_MAX_REQUESTS: 3, // 3 requests
  
  // Admin endpoints
  ADMIN_WINDOW_MS: 15 * 60 * 1000, // 15 phút
  ADMIN_MAX_REQUESTS: 50, // 50 requests
  
  // General endpoints
  GENERAL_WINDOW_MS: 15 * 60 * 1000, // 15 phút
  GENERAL_MAX_REQUESTS: 100, // 100 requests
};

// #endregion

// #region Regex Patterns

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  PHONE: /^[0-9]{10,11}$/,
  VERIFICATION_CODE: /^[0-9]{6}$/,
};

// #endregion
