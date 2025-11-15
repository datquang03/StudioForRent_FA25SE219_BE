// #region Imports
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { User } from "../models/index.js";
import { AUTH_MESSAGES } from "../utils/constants.js";
// #endregion

// #region Authentication Middleware
/**
 * Protect routes - Verify JWT token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-passwordHash -verificationCode -verificationCodeExpiry");

      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: AUTH_MESSAGES.USER_NOT_FOUND 
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ 
          success: false,
          message: AUTH_MESSAGES.ACCOUNT_INACTIVE 
        });
      }

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
// #endregion

// #region Authorization Middleware
/**
 * Authorize roles - Check user role permissions
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten roles in case array is passed
    const allowedRoles = roles.flat();
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: AUTH_MESSAGES.UNAUTHORIZED,
      });
    }
    next();
  };
};
// #endregion
