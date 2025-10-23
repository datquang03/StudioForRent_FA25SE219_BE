// ============================================
// RESPONSE MESSAGES
// ============================================

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
};

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

export const RATE_LIMIT_MESSAGES = {
  AUTH_LIMIT: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút!",
  LOGIN_LIMIT: "Quá nhiều lần đăng nhập thất bại. Tài khoản tạm thời bị khóa 15 phút để bảo mật!",
  VERIFICATION_LIMIT: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 5 phút!",
  PASSWORD_RESET_LIMIT: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 30 phút!",
  ADMIN_LIMIT: "Quá nhiều yêu cầu admin. Vui lòng thử lại sau!",
  GENERAL_LIMIT: "Quá nhiều yêu cầu. Vui lòng thử lại sau!",
};

// ============================================
// ENUMS
// ============================================

export const USER_ROLES = {
  CUSTOMER: "customer",
  STAFF: "staff",
  ADMIN: "admin",
};

export const ACCOUNT_ROLES = {
  STAFF: "staff",
  ADMIN: "admin",
};

export const EQUIPMENT_STATUS = {
  AVAILABLE: "available",
  IN_USE: "in_use",
  MAINTENANCE: "maintenance",
};

export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

export const BILL_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  CANCELLED: "cancelled",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
};

export const REPORT_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
};

export const NOTIFICATION_TYPE = {
  CONFIRMATION: "confirmation",
  CHANGE: "change",
  REMINDER: "reminder",
};

export const POLICY_TYPE = {
  CANCELLATION: "cancellation",
  REFUND: "refund",
  ADDITIONAL_SERVICES: "additional_services",
};

export const REPORT_TARGET_TYPE = {
  STUDIO: "studio",
  BOOKING: "booking",
  USER: "user",
};

export const REFUND_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PROCESSED: "processed",
};

export const SET_DESIGN_STATUS = {
  PENDING: "pending",
  GENERATED: "generated",
  APPROVED: "approved",
  REJECTED: "rejected",
  IMPLEMENTED: "implemented",
};

// ============================================
// TIME CONSTANTS
// ============================================

export const TIME_CONSTANTS = {
  VERIFICATION_CODE_EXPIRY_MINUTES: 15,
  JWT_EXPIRY: "1d",
  REFRESH_TOKEN_EXPIRY: "7d",
};

// ============================================
// RATE LIMIT CONSTANTS
// ============================================

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

// ============================================
// REGEX PATTERNS
// ============================================

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  PHONE: /^[0-9]{10,11}$/,
  VERIFICATION_CODE: /^[0-9]{6}$/,
};
