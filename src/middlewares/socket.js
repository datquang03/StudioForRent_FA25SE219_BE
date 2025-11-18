// #region Imports
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import logger from "../utils/logger.js";
// #endregion

/**
 * ============================================
 * SOCKET.IO AUTHENTICATION MIDDLEWARE
 * Xác thực JWT token cho Socket.io connections
 * ============================================
 */

/**
 * Socket.io authentication middleware
 * Verify JWT token and attach user to socket
 */
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select("-passwordHash -verificationCode -verificationCodeExpiry");

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    if (!user.isActive) {
      return next(new Error("Authentication error: Account is inactive"));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user._id.toString();

    logger.info(`Socket authenticated for user: ${user.username} (${user.role})`);
    next();
  } catch (error) {
    logger.error("Socket authentication failed:", error);
    return next(new Error("Authentication error: Invalid token"));
  }
};

/**
 * ============================================
 * SOCKET.IO CONNECTION HANDLER
 * Xử lý Socket.io connection events
 * ============================================
 */

/**
 * Handle Socket.io connections
 */
export const handleSocketConnection = (io) => {
  io.on("connection", (socket) => {
    const { user, userId } = socket;
    logger.info(`User connected: ${user.username} (${user.role}) - Socket: ${socket.id}`);

    // Auto join user's personal room for direct messages
    socket.join(userId);
    logger.info(`User ${user.username} auto-joined personal room: ${userId}`);

    // Join conversation room (for booking-specific chats)
    socket.on("joinConversation", (bookingId) => {
      if (!bookingId || typeof bookingId !== 'string') {
        socket.emit('error', { message: 'Invalid booking ID' });
        return;
      }

      socket.join(bookingId);
      logger.info(`User ${user.username} joined conversation: ${bookingId}`);
      socket.emit('joinedConversation', { bookingId });
    });

    // Leave conversation room
    socket.on("leaveConversation", (bookingId) => {
      if (!bookingId || typeof bookingId !== 'string') {
        socket.emit('error', { message: 'Invalid booking ID' });
        return;
      }

      socket.leave(bookingId);
      logger.info(`User ${user.username} left conversation: ${bookingId}`);
      socket.emit('leftConversation', { bookingId });
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${user.username} (${user.role}) - Socket: ${socket.id}`);
    });
  });
};