//#region Imports
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import logger from '../utils/logger.js';
//#endregion

/**
 * ============================================
 * ENHANCED RATE LIMITING MIDDLEWARE
 * Per-IP + Per-User rate limiting với monitoring
 * ============================================
 */

//#region Helper Functions
/**
 * Create rate limiter with enhanced logging
 */
const createRateLimiter = (options) => {
  return rateLimit({
    ...options,
    keyGenerator: ipKeyGenerator, // Use the ipKeyGenerator to handle IPv6 addresses correctly
    handler: (req, res) => {
      const userId = req.user?._id || 'anonymous';
      const userRole = req.user?.role || 'guest';
      
      logger.warn(`Rate limit exceeded - IP: ${req.ip}, User: ${userId} (${userRole}), Path: ${req.path}`);
      
      res.status(429).json({
        success: false,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
};

/**
 * Per-user rate limiter factory
 * Kết hợp IP + User ID để tăng độ chính xác
 */
const createPerUserLimiter = (options) => {
  return rateLimit({
    ...options,
    keyGenerator: (req, res) => {
      const userId = req.user?._id?.toString() || 'anonymous';
      const ip = ipKeyGenerator(req); // Use IPv6-safe IP key generator
      return `${userId}:${ip}`; // Combine user ID + IP
    },
    handler: (req, res) => {
      const userId = req.user?._id || 'anonymous';
      const userRole = req.user?.role || 'guest';
      
      logger.warn(`Per-user rate limit exceeded - User: ${userId} (${userRole}), IP: ${req.ip}, Path: ${req.path}`);
      
      res.status(429).json({
        success: false,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
};
//#endregion

//#region Authentication Rate Limiters
/**
 * Rate limiter cho authentication endpoints (login, register)
 * Giới hạn: 5 requests / 15 phút / IP
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 requests
  message: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter nghiêm ngặt cho login (riêng)
 * Giới hạn: 10 requests / 15 phút / IP
 * Áp dụng riêng cho login endpoint
 */
export const strictLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 lần login
  skipSuccessfulRequests: true, // Chỉ đếm request trả về status code không phải 2xx
  message: "Quá nhiều lần đăng nhập thất bại. Tài khoản tạm thời bị khóa 15 phút để bảo mật!",
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region Verification Rate Limiters
/**
 * Rate limiter cho verification code endpoints
 * Giới hạn: 3 requests / 5 phút / IP
 * Chặt hơn để ngăn spam verification code
 */
export const verificationLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 3, // Tối đa 3 requests
  message: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 5 phút!",
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region Password Reset Rate Limiters
/**
 * Rate limiter cho password reset endpoints
 * Giới hạn: 3 requests / 30 phút / IP
 * Rất chặt để bảo vệ tính năng nhạy cảm
 */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 phút
  max: 3, // Tối đa 3 requests
  message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 30 phút!",
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region Admin Rate Limiters
/**
 * Rate limiter cho admin operations
 * Giới hạn: 50 requests / 15 phút / IP
 */
export const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 50, // Tối đa 50 requests
  message: "Quá nhiều yêu cầu admin. Vui lòng thử lại sau!",
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region General Rate Limiters
/**
 * Rate limiter chung cho các API endpoints
 * Giới hạn: 100 requests / 15 phút / IP
 */
export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests
  message: "Quá nhiều yêu cầu. Vui lòng thử lại sau!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-user rate limiter cho authenticated users
 * Giới hạn: 200 requests / 15 phút / user
 * Bảo vệ tốt hơn khỏi abuse từ cùng một user
 */
export const userLimiter = createPerUserLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 200, // Tối đa 200 requests per user
  message: "Quá nhiều yêu cầu từ tài khoản này. Vui lòng thử lại sau!",
  standardHeaders: true,
  legacyHeaders: false,
});
//#endregion

//#region Specialized Rate Limiters
/**
 * Rate limiter cho file upload operations
 * Giới hạn: 10 uploads / giờ / user
 */
export const uploadLimiter = createPerUserLimiter({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 10, // Tối đa 10 uploads per user per hour
  message: "Quá nhiều file upload. Vui lòng thử lại sau 1 giờ!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter cho booking operations
 * Giới hạn: 20 bookings / giờ / user
 */
export const bookingLimiter = createPerUserLimiter({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 20, // Tối đa 20 bookings per user per hour
  message: "Quá nhiều yêu cầu đặt phòng. Vui lòng thử lại sau 1 giờ!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter cho messaging operations
 * Giới hạn: 50 messages / phút / user
 */
export const messageLimiter = createPerUserLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 50, // Tối đa 50 messages per user per minute
  message: "Quá nhiều tin nhắn. Vui lòng chậm lại!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter cho search operations
 * Giới hạn: 30 searches / phút / user
 */
export const searchLimiter = createPerUserLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 30, // Tối đa 30 searches per user per minute
  message: "Quá nhiều yêu cầu tìm kiếm. Vui lòng thử lại sau!",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter cho AI operations (setDesign)
 * Giới hạn: 5 AI requests / 15 phút / user
 * Rất chặt để kiểm soát chi phí AI API
 */
export const aiLimiter = createPerUserLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 AI requests per user per 15 minutes
  message: "Quá nhiều yêu cầu AI. Vui lòng thử lại sau 15 phút!",
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
  userLimiter,
  uploadLimiter,
  bookingLimiter,
  messageLimiter,
  searchLimiter,
  aiLimiter,
};
