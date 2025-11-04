import logger from '../utils/logger.js';
import { NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError } from '../utils/errors.js';

/**
 * ============================================
 * CENTRALIZED ERROR HANDLER
 * Xử lý và chuẩn hóa tất cả errors trong ứng dụng
 * ============================================
 */

/**
 * Global error handler middleware
 * Tự động xử lý mọi lỗi xảy ra trong app
 */
export const errorHandler = (err, req, res, next) => {
  // Log error chi tiết để dev debug (chỉ dev thấy, user không thấy)
  // logger.error signature: error(message, error = null, meta = {})
  logger.error(`[${req.method}] ${req.path} - Error:`, err, {
    statusCode: err.statusCode || 500,
  });

  // Xác định status code dựa trên loại error
  let statusCode = err.statusCode || 500;
  
  // ============================================
  // XỬ LÝ CUSTOM ERRORS (do dev tự throw)
  // ============================================
  if (err instanceof NotFoundError) {
    statusCode = 404;
  } else if (err instanceof ValidationError) {
    statusCode = 400;
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
  } else if (err instanceof ConflictError) {
    statusCode = 409;
  }
  
  // ============================================
  // XỬ LÝ MONGOOSE ERRORS (từ MongoDB)
  // ============================================
  
  // Invalid ObjectId (ví dụ: /api/studios/abc thay vì ObjectId 24 ký tự)
  else if (err.name === 'CastError') {
    statusCode = 400;
    err.message = 'ID không hợp lệ!';
  }
  
  // Duplicate key (email/username đã tồn tại)
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)?.[0] || 'Trường';
    err.message = `${field} đã tồn tại trong hệ thống!`;
  }
  
  // Mongoose validation errors (thiếu required field, sai format...)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    // Mongoose đã tạo message rõ ràng, giữ nguyên
  }
  
  // ============================================
  // XỬ LÝ JWT ERRORS
  // ============================================
  
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    err.message = 'Token không hợp lệ!';
  }
  
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    err.message = 'Token đã hết hạn!';
  }

  // Trả response về client
  res.status(statusCode).json({
    success: false,
    message: err.message,
    // Chỉ show chi tiết trong development mode
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
};

/**
 * 404 Not Found handler
 * Bắt các route không tồn tại
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} không tồn tại!`);
  next(error);
};
