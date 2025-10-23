import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Customer from "../models/Customer/customer.model.js";
import Account from "../models/Account/account.model.js";
import { TIME_CONSTANTS, AUTH_MESSAGES } from "../utils/constants.js";

// ============================================
// JWT UTILITIES
// ============================================

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @param {string} role - User role (customer, staff, admin)
 * @returns {string} - JWT token
 */
export const generateToken = (id, role = "customer") => {
  return jwt.sign(
    { id, role }, 
    process.env.JWT_SECRET, 
    { expiresIn: TIME_CONSTANTS.JWT_EXPIRY }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("INVALID_TOKEN");
  }
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Protect routes - Require authentication
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if token exists in header
  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      // Extract token
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = verifyToken(token);

      // Get user based on role
      if (decoded.role === "customer") {
        req.user = await Customer.findById(decoded.id).select("-passwordHash");
      } else if (["staff", "admin"].includes(decoded.role)) {
        req.user = await Account.findById(decoded.id).select("-passwordHash");
      }

      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: AUTH_MESSAGES.USER_NOT_FOUND 
        });
      }

      req.user.role = decoded.role;
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false,
        message: AUTH_MESSAGES.TOKEN_INVALID 
      });
    }
  } else {
    return res.status(401).json({ 
      success: false,
      message: AUTH_MESSAGES.TOKEN_MISSING 
    });
  }
});

/**
 * Authorize based on roles
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: AUTH_MESSAGES.UNAUTHORIZED,
      });
    }
    next();
  };
};

