//#region Imports
import rateLimit from "express-rate-limit";
//#endregion

/**
 * ============================================
 * RATE LIMITING MIDDLEWARE
 * Ngăn chặn brute force attacks và spam
 * ============================================
 */

//#region Authentication Rate Limiters
/**
 * Rate limiter cho authentication endpoints (login, register)
 * Giới hạn: 5 requests / 15 phút / IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 requests
  message: {
    success: false,
    message: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút!",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút!",
    });
  },
});

/**
 * Rate limiter nghiêm ngặt cho login (riêng)
 * Giới hạn: 10 requests / 15 phút / IP
 * Áp dụng riêng cho login endpoint
 */
export const strictLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 lần login
  skipSuccessfulRequests: true, // Chỉ đếm các request thất bại
  message: {
    success: false,
    message: "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút!",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip} on login endpoint`);
    res.status(429).json({
      success: false,
      message: "Quá nhiều lần đăng nhập thất bại. Tài khoản tạm thời bị khóa 15 phút để bảo mật!",
    });
  },
});
//#endregion

//#region Verification Rate Limiters
/**
 * Rate limiter cho verification code endpoints
 * Giới hạn: 3 requests / 5 phút / IP
 * Chặt hơn để ngăn spam verification code
 */
export const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 3, // Tối đa 3 requests
  message: {
    success: false,
    message: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 5 phút!",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 5 phút!",
    });
  },
});
//#endregion

//#region Password Reset Rate Limiters
/**
 * Rate limiter cho password reset endpoints
 * Giới hạn: 3 requests / 30 phút / IP
 * Rất chặt để bảo vệ tính năng nhạy cảm
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 phút
  max: 3, // Tối đa 3 requests
  message: {
    success: false,
    message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 30 phút!",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 30 phút!",
    });
  },
});
//#endregion

//#region Admin Rate Limiters
/**
 * Rate limiter cho admin operations
 * Giới hạn: 50 requests / 15 phút / IP
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 50, // Tối đa 50 requests
  message: {
    success: false,
    message: "Quá nhiều yêu cầu admin. Vui lòng thử lại sau!",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region General Rate Limiters
/**
 * Rate limiter chung cho các API endpoints
 * Giới hạn: 100 requests / 15 phút / IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests
  message: {
    success: false,
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau!",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

export default {
  authLimiter,
  verificationLimiter,
  generalLimiter,
  passwordResetLimiter,
  adminLimiter,
  strictLoginLimiter,
};
